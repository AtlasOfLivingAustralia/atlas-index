#!/bin/bash

###
# Print the fingerprint of a pipeline: md5 of the pipeline template plus any extra values that are
# baked into the pipeline stack as parameters (e.g. Playwright shard counts). The ExportConfig stage
# compares this with the fingerprint the running pipeline was deployed with, and redeploys itself when
# they differ.
#
# Usage: fingerprint.sh path/to/pipeline.yaml [extra values...]

set -euo pipefail

template=$1
shift

{ cat "$template"; echo "$*"; } | if command -v md5sum > /dev/null; then md5sum | awk '{print $1}'; else md5 -q; fi
