#!/bin/bash
set -uo pipefail

###
# The Playwright gate for one UI, in one container: serve the prebuilt bundle with `vite preview` on
# :5173 (the port baked into .env.playwright) and run every browser in PLAYWRIGHT_BROWSERS against it.
# All backends are mocked by the specs, so nothing else runs. When the UI has a variant build
# (PLAYWRIGHT_VARIANT_*), its targeted spec runs against that build afterwards.
#
# Both runs are merged into one HTML + JUnit report (.pw-report/), the HTML report is published to
# S3, and the exit code is the gate: non-zero stops the pipeline before Publish. A global timeout turns
# a hung run (e.g. a browser that never launches) into a failure well inside the CodeBuild timeout.
#
# Run from the repository root.
# Required env: UI_APP PLAYWRIGHT_BROWSERS REPORTS_BUCKET EXECUTION_ID
#               CODEBUILD_SRC_DIR_PlaywrightBundleArtifact
# Optional env: PLAYWRIGHT_WORKERS PLAYWRIGHT_VARIANT_ENV PLAYWRIGHT_VARIANT_SPEC PLAYWRIGHT_VARIANT_GREP
#               PLAYWRIGHT_IMAGE_VERSION (set by the build image)

BUNDLE=${CODEBUILD_SRC_DIR_PlaywrightBundleArtifact:?the PlaywrightBundleArtifact input is required}
S3_REPORT=s3://$REPORTS_BUCKET/$UI_APP/$EXECUTION_ID/html-report
WORK=$PWD/.pw-report
rm -rf "$WORK"
mkdir -p "$WORK/blobs"

read -ra browsers <<< "${PLAYWRIGHT_BROWSERS//,/ }"
projects=("${browsers[@]/#/--project=}")

cd "$UI_APP" || exit 1

# a yarn.lock Playwright bump can land before the base pipeline rebuilds the image
installed=$(yarn playwright --version | awk '{print $2}')
if [[ $installed != "${PLAYWRIGHT_IMAGE_VERSION:-}" ]]; then
  echo "image has Playwright ${PLAYWRIGHT_IMAGE_VERSION:-none}, workspace has $installed: installing ${browsers[*]}"
  yarn playwright install --with-deps "${browsers[@]}" || exit 1
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

# run <name> <playwright args...>; returns the Playwright exit code. Blob reports exist only so the
# main and variant runs merge into one report; each run gets its own blob directory because the blob
# reporter empties its output directory first.
run() {
  local name=$1
  shift
  CI=true PLAYWRIGHT_BLOB_OUTPUT_DIR=$WORK/$name PLAYWRIGHT_BLOB_OUTPUT_NAME=$name.zip \
    yarn playwright test "${projects[@]}" --reporter=blob,list --workers="${PLAYWRIGHT_WORKERS:-4}" \
      --global-timeout=$((30 * 60 * 1000)) "$@"
  local status=$?
  cp "$WORK/$name"/*.zip "$WORK/blobs/" 2> /dev/null
  return $status
}

serve dist
run main
status=$?

if [[ -n ${PLAYWRIGHT_VARIANT_ENV:-} ]]; then
  serve dist-variant
  # the specs read the variant flag too, not only the build
  export "${PLAYWRIGHT_VARIANT_ENV?}"
  run variant "$PLAYWRIGHT_VARIANT_SPEC" --grep "$PLAYWRIGHT_VARIANT_GREP"
  variant_status=$?
  (( status == 0 )) && status=$variant_status
fi
kill "$PREVIEW_PID"

if PLAYWRIGHT_HTML_OUTPUT_DIR=$WORK/html PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JUNIT_OUTPUT_FILE=$WORK/junit.xml \
     yarn playwright merge-reports --reporter html,junit "$WORK/blobs" > /dev/null; then
  aws s3 cp "$WORK/html" "$S3_REPORT/" --recursive --only-show-errors
  echo "HTML report: $S3_REPORT/"
  echo "  summary (7 days): $(aws s3 presign "$S3_REPORT/index.html" --expires-in 604800)"
  echo "  full report:      aws s3 sync $S3_REPORT/ report && npx playwright show-report report"
else
  echo "merging the reports failed"
  (( status == 0 )) && status=1
fi

if (( status != 0 )); then
  echo "Playwright gate FAILED for $UI_APP (exit code $status)"
  exit "$status"
fi
echo "Playwright gate passed for $UI_APP"
