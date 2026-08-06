#!/bin/bash

# Run Playwright tests against a live environment.
# No local build, no mock servers, no file swapping.
#
# Usage:
#   ./run-live-test.sh                              # uses live-config.json, auto workers
#   ./run-live-test.sh live-config.json             # explicit config, auto workers
#   ./run-live-test.sh live-config.json 4           # explicit config, 4 workers
#
# Each run writes a timestamped HTML report to:
#   playwright-live-reports/YYYY-MM-DD_HH-MM-SS_<config-basename>/

CONFIG_FILE="${1:-live-config.json}"
THREAD_COUNT="${2:-}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: config file not found: $CONFIG_FILE"
  exit 1
fi

export LIVE_CONFIG_PATH
LIVE_CONFIG_PATH="$(realpath "$CONFIG_FILE")"

# Build a timestamped report directory name from the current time and config filename.
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
CONFIG_BASENAME="$(basename "$CONFIG_FILE" .json)"
REPORT_DIR="playwright-live-reports/${TIMESTAMP}_${CONFIG_BASENAME}"

echo "Running live Playwright tests against config: $LIVE_CONFIG_PATH"
echo "Report will be written to: $REPORT_DIR"

WORKERS_ARG=""
if [ -n "$THREAD_COUNT" ]; then
  WORKERS_ARG="--workers=$THREAD_COUNT"
  echo "Workers: $THREAD_COUNT"
fi

yarn playwright test \
  --config=playwright.config.live.ts \
  $WORKERS_ARG

# Move the generated HTML report from the default location into the timestamped directory.
mkdir -p playwright-live-reports
if [ -d "playwright-report" ]; then
  mv playwright-report "$REPORT_DIR"
  echo "HTML report: $REPORT_DIR/index.html"
else
  echo "Warning: playwright-report directory not found after test run."
fi
