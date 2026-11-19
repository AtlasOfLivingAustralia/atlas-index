#!/bin/bash
set -euo pipefail

###
# Build the instrumented Playwright bundle(s) for one UI into .pw-bundle/ (run from the repo root).
#   .pw-bundle/dist          the build the Playwright gate tests
#   .pw-bundle/dist-variant  only when PLAYWRIGHT_VARIANT_ENV is set, e.g. search-ui's licence filter
#
# The per-UI steps mirror <ui>/run-playwright-test.sh, keep them in sync.
#
# Required env: UI_APP. Optional: PLAYWRIGHT_VARIANT_ENV (KEY=value build override)

OUT=$PWD/.pw-bundle
rm -rf "$OUT"
mkdir -p "$OUT"
cd "$UI_APP"

# nothing but .env.playwright may feed the build
rm -f .env .env.local .env.production .env.production.local

if [[ $UI_APP == specimens-ui ]]; then
  cp tests/resources/collections.json src/api/sources/collections.json
fi

build() {
  yarn run build:playwright
  if [[ $UI_APP == regions-ui ]]; then
    cp tests/resources/regionsList.json dist/regionsList.json
  fi
  cp -r dist "$OUT/$1"
}

build dist

if [[ -n ${PLAYWRIGHT_VARIANT_ENV:-} ]]; then
  echo "building the variant bundle with $PLAYWRIGHT_VARIANT_ENV"
  export "${PLAYWRIGHT_VARIANT_ENV?}"
  build dist-variant
fi
