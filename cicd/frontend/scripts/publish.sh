#!/bin/bash
set -euo pipefail

###
# Publish a release build to the site bucket without downtime, then invalidate CloudFront.
#   1. assets/* (content hashed) first, cached forever; old ones are NOT deleted yet
#   2. other files except index.html, with MAX_AGE; stale non-asset files are deleted
#   3. index.html last, no-cache, which switches users to the new release; only then is the release
#      recorded in _releases/<UTC time>, the list of its assets
#   4. assets of releases superseded more than ASSET_RETENTION_DAYS ago are pruned, so browsers still
#      running an older release can lazy-load its chunks for a while. The release times say when each
#      release was superseded.
#
# Required env: SOURCE_BUCKET DISTRIBUTION_ID MAX_AGE ASSET_RETENTION_DAYS
#               CODEBUILD_SRC_DIR_BuildReleaseArtifact

DIST=${CODEBUILD_SRC_DIR_BuildReleaseArtifact:?the BuildReleaseArtifact input is required}
BUCKET=s3://$SOURCE_BUCKET
[[ -f $DIST/index.html ]] || { echo "no index.html in the release build"; exit 1; }

if [[ -d $DIST/assets ]]; then
  aws s3 sync "$DIST/assets" "$BUCKET/assets" --cache-control "public, max-age=31536000, immutable" --only-show-errors
fi
aws s3 sync "$DIST" "$BUCKET" --exclude "assets/*" --exclude "_releases/*" --exclude index.html --delete \
  --cache-control "public, max-age=$MAX_AGE" --only-show-errors
aws s3 cp "$DIST/index.html" "$BUCKET/index.html" --cache-control "no-cache" --only-show-errors
# recorded only once index.html is live, so a failed publish never counts as replacing the live release
(cd "$DIST" && find assets -type f 2> /dev/null | sort) \
  | aws s3 cp - "$BUCKET/_releases/$(date -u +%Y%m%dT%H%M%S)" --only-show-errors

cutoff=$(date -u -d "-$ASSET_RETENTION_DAYS days" +%Y%m%dT%H%M%S)
releases=$(aws s3api list-objects-v2 --bucket "$SOURCE_BUCKET" --prefix _releases/ --query 'Contents[].Key' \
  --output text | tr '\t' '\n' | sort)
# releases older than the cutoff, except the newest of them: it was live until after the cutoff
expired=$(awk -v c="_releases/$cutoff" '$0 < c' <<< "$releases" | sed '$d')
keep=$(comm -23 <(echo "$releases") <(echo "$expired") \
  | while read -r release; do aws s3 cp "$BUCKET/$release" - --only-show-errors || exit 1; done | sort -u)
aws s3api list-objects-v2 --bucket "$SOURCE_BUCKET" --prefix assets/ --output json \
  | jq -r '.Contents[]?.Key' \
  | sort \
  | comm -23 - <(echo "$keep") \
  | while read -r key; do
      echo "pruning $key"
      aws s3 rm "$BUCKET/$key" --only-show-errors
    done
for release in $expired; do aws s3 rm "$BUCKET/$release" --only-show-errors; done

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query Invalidation.Id --output text
