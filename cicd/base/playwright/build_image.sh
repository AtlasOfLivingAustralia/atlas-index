#!/bin/bash
set -euo pipefail

###
# Build and push the Playwright build image (see Dockerfile) when the Playwright version in yarn.lock,
# the Node major in .nvmrc or the Dockerfile has no image yet, then point :latest at it.
# Run from the repository root.
#
# Required env: REPO_NAME, REPO_URI

# the image ships browsers for exactly one Playwright version, so every workspace must resolve the same one
PLAYWRIGHT_VERSION=$(awk '/^"@playwright\/test@/ { found=1; next } found && /^  version:/ { print $2; found=0 }' yarn.lock | sort -u)
if [[ $(grep -c . <<< "$PLAYWRIGHT_VERSION") -ne 1 ]]; then
  echo "expected exactly one @playwright/test version in yarn.lock, found: ${PLAYWRIGHT_VERSION:-none}" >&2
  exit 1
fi
NODE_MAJOR=$(cut -d. -f1 < .nvmrc | tr -d 'v')
TAG="pw${PLAYWRIGHT_VERSION}-node${NODE_MAJOR}-$(cicd/fingerprint.sh cicd/base/playwright/Dockerfile | cut -c1-8)"
echo "image tag: $TAG"

if aws ecr describe-images --repository-name "$REPO_NAME" --image-ids imageTag="$TAG" > /dev/null 2>&1; then
  echo "$TAG already exists, skipping the build"
else
  aws ecr get-login-password | docker login -u AWS --password-stdin "${REPO_URI%%/*}"
  docker build \
    --build-arg PLAYWRIGHT_VERSION="$PLAYWRIGHT_VERSION" \
    --build-arg NODE_MAJOR="$NODE_MAJOR" \
    -t "$REPO_URI:$TAG" \
    cicd/base/playwright
  docker push "$REPO_URI:$TAG"
fi

# also moves :latest back when an older version is redeployed (rollback)
MANIFEST=$(aws ecr batch-get-image --repository-name "$REPO_NAME" --image-ids imageTag="$TAG" \
             --query 'images[0].imageManifest' --output text)
aws ecr put-image --repository-name "$REPO_NAME" --image-tag latest --image-manifest "$MANIFEST" > /dev/null 2>&1 \
  || echo "latest already points at $TAG"
