#!/bin/bash
set -euo pipefail

###
# Print the @playwright/test version resolved in yarn.lock (run from the repository root).
# Fails when the workspaces resolve more than one version, because the build image ships the
# browsers for exactly one.

versions=$(awk '/^"@playwright\/test@/ { found=1; next } found && /^  version:/ { print $2; found=0 }' yarn.lock | sort -u)

if [[ $(echo "$versions" | grep -c .) -ne 1 ]]; then
  echo "expected exactly one @playwright/test version in yarn.lock, found: ${versions:-none}" >&2
  exit 1
fi
echo "$versions"
