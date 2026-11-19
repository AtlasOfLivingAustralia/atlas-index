#!/bin/bash
set -euo pipefail

###
# The Playwright gate: merge every shard's blob report into one HTML + JUnit report, publish it to
# S3, then fail if any shard is missing or had failures, so nothing is published.
#
# Required env: UI_APP REPORTS_BUCKET EXECUTION_ID SHARD_TOTAL PLAYWRIGHT_BROWSERS
# Run from the repository root; writes .pw-report/ (junit.xml is picked up as a CodeBuild report).

S3_PREFIX=s3://$REPORTS_BUCKET/$UI_APP/$EXECUTION_ID
WORK=$PWD/.pw-report
rm -rf "$WORK"
mkdir -p "$WORK/blobs" "$WORK/status"

aws s3 cp "$S3_PREFIX/blobs/" "$WORK/blobs/" --recursive --only-show-errors
aws s3 cp "$S3_PREFIX/status/" "$WORK/status/" --recursive --only-show-errors

problems=()
for browser in ${PLAYWRIGHT_BROWSERS//,/ }; do
  for shard in $(seq 1 "$SHARD_TOTAL"); do
    file=$WORK/status/$browser-$shard
    if [[ ! -f $file ]]; then
      problems+=("$browser-$shard: no result")
    elif [[ $(cat "$file") != 0 ]]; then
      problems+=("$browser-$shard: Playwright exit code $(cat "$file")")
    fi
  done
done

if compgen -G "$WORK/blobs/*.zip" > /dev/null; then
  # the build image ships a global @playwright/test of the workspace's version
  PLAYWRIGHT_HTML_OUTPUT_DIR=$WORK/html PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JUNIT_OUTPUT_FILE=$WORK/junit.xml \
    playwright merge-reports --reporter html,junit "$WORK/blobs" || problems+=("merging the reports failed")
  aws s3 cp "$WORK/html" "$S3_PREFIX/html-report/" --recursive --only-show-errors
  echo "HTML report: $S3_PREFIX/html-report/"
  echo "  summary (7 days): $(aws s3 presign "$S3_PREFIX/html-report/index.html" --expires-in 604800)"
  echo "  full report:      aws s3 sync $S3_PREFIX/html-report/ report && npx playwright show-report report"
else
  problems+=("no blob reports were uploaded")
fi

if (( ${#problems[@]} )); then
  printf 'Playwright gate FAILED:\n'
  printf '  %s\n' "${problems[@]}"
  exit 1
fi
echo "Playwright gate passed for $UI_APP"
