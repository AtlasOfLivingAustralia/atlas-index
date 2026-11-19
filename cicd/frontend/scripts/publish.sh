#!/bin/bash
set -euo pipefail

###
# Publish a release build to the site bucket without downtime, then invalidate CloudFront.
#   1. assets/* (content hashed) first, cached forever; old ones are NOT deleted yet
#   2. other files except index.html, with MAX_AGE; stale non-asset files are deleted
#   3. index.html last, no-cache, which switches users to the new release
#   4. superseded assets older than ASSET_RETENTION_DAYS are pruned, so browsers still running an
#      older release can lazy-load its chunks for a while
#
# Required env: SOURCE_BUCKET DISTRIBUTION_ID MAX_AGE ASSET_RETENTION_DAYS
#               CODEBUILD_SRC_DIR_BuildReleaseArtifact

DIST=${CODEBUILD_SRC_DIR_BuildReleaseArtifact:?the BuildReleaseArtifact input is required}
BUCKET=s3://$SOURCE_BUCKET
[[ -f $DIST/index.html ]] || { echo "no index.html in the release build"; exit 1; }

if [[ -d $DIST/assets ]]; then
  aws s3 sync "$DIST/assets" "$BUCKET/assets" --cache-control "public, max-age=31536000, immutable" --only-show-errors
fi
aws s3 sync "$DIST" "$BUCKET" --exclude "assets/*" --exclude index.html --delete \
  --cache-control "public, max-age=$MAX_AGE" --only-show-errors
aws s3 cp "$DIST/index.html" "$BUCKET/index.html" --cache-control "no-cache" --only-show-errors

cutoff=$(date -u -d "-$ASSET_RETENTION_DAYS days" +%Y-%m-%dT%H:%M:%S)
current=$(cd "$DIST" && find assets -type f 2> /dev/null | sort)
aws s3api list-objects-v2 --bucket "$SOURCE_BUCKET" --prefix assets/ --output json \
  | jq -r --arg cutoff "$cutoff" '.Contents[]? | select(.LastModified < $cutoff) | .Key' \
  | sort \
  | comm -23 - <(echo "$current") \
  | while read -r key; do
      echo "pruning $key"
      aws s3 rm "$BUCKET/$key" --only-show-errors
    done

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query Invalidation.Id --output text
