#!/bin/bash
set -uo pipefail

###
# One Playwright shard: serve the prebuilt bundle with `vite preview` on :5173 (the port baked into
# .env.playwright; every CodeBuild container is isolated) and run one browser/shard slice, writing a
# blob report. All backends are mocked by the specs, so nothing else needs to run.
#
# Test failures do NOT fail this build: the exit code is recorded next to the blob in S3 and the
# PlaywrightReport action fails the pipeline after merging every shard into one report. Anything
# else going wrong (install, server start, upload) fails this build, which also stops the pipeline.
# A global timeout turns a hung run (e.g. a browser that never launches) into a recorded failure
# well inside the CodeBuild timeout, so the report still gets merged.
#
# Required env: UI_APP BROWSER SHARD SHARD_TOTAL REPORTS_BUCKET EXECUTION_ID
#               CODEBUILD_SRC_DIR_PlaywrightBundleArtifact
# Optional env: PLAYWRIGHT_WORKERS PLAYWRIGHT_VARIANT_ENV PLAYWRIGHT_VARIANT_SPEC PLAYWRIGHT_VARIANT_GREP
#               PLAYWRIGHT_IMAGE_VERSION (set by the build image)

BUNDLE=${CODEBUILD_SRC_DIR_PlaywrightBundleArtifact:?the PlaywrightBundleArtifact input is required}
NAME=$BROWSER-$SHARD
S3_PREFIX=s3://$REPORTS_BUCKET/$UI_APP/$EXECUTION_ID
BLOB_DIR=$PWD/.pw-blobs
rm -rf "$BLOB_DIR"
mkdir -p "$BLOB_DIR"

cd "$UI_APP" || exit 1

# a yarn.lock Playwright bump can land before the base pipeline rebuilds the image
installed=$(yarn playwright --version | awk '{print $2}')
if [[ $installed != "${PLAYWRIGHT_IMAGE_VERSION:-}" ]]; then
  echo "image has Playwright ${PLAYWRIGHT_IMAGE_VERSION:-none}, workspace has $installed: installing $BROWSER"
  yarn playwright install --with-deps "$BROWSER" || exit 1
fi

PREVIEW_PID=
serve() {
  [[ -n $PREVIEW_PID ]] && kill "$PREVIEW_PID" && wait "$PREVIEW_PID" 2> /dev/null
  rm -rf dist
  cp -r "$BUNDLE/$1" dist || exit 1
  yarn vite preview --port 5173 --strictPort > "/tmp/preview-$1.log" 2>&1 &
  PREVIEW_PID=$!
  for _ in $(seq 60); do
    curl -sf -o /dev/null http://localhost:5173/ && return
    sleep 1
  done
  echo "vite preview did not start"; cat "/tmp/preview-$1.log"; exit 1
}

# run <blob name> <playwright args...>; returns the Playwright exit code. Each run gets its own blob
# directory because the blob reporter empties its output directory first.
run() {
  local blob=$1
  shift
  CI=true PLAYWRIGHT_BLOB_OUTPUT_DIR=$BLOB_DIR/$blob PLAYWRIGHT_BLOB_OUTPUT_NAME=$blob.zip \
    yarn playwright test --project="$BROWSER" --reporter=blob,list --workers="${PLAYWRIGHT_WORKERS:-4}" \
      --global-timeout=$((20 * 60 * 1000)) "$@"
}

serve dist
run "$NAME" --shard="$SHARD/$SHARD_TOTAL"
status=$?

if [[ -n ${PLAYWRIGHT_VARIANT_ENV:-} && $SHARD == 1 ]]; then
  serve dist-variant
  # the specs read the variant flag too, not only the build
  export "${PLAYWRIGHT_VARIANT_ENV?}"
  run "$BROWSER-variant" "$PLAYWRIGHT_VARIANT_SPEC" --grep "$PLAYWRIGHT_VARIANT_GREP"
  variant_status=$?
  (( status == 0 )) && status=$variant_status
fi
kill "$PREVIEW_PID"

for dir in "$BLOB_DIR"/*/; do
  aws s3 cp "$dir" "$S3_PREFIX/blobs/" --recursive --only-show-errors || exit 1
done
echo "$status" | aws s3 cp - "$S3_PREFIX/status/$NAME" --only-show-errors || exit 1
echo "shard $NAME finished with Playwright exit code $status"
