#!/bin/bash
set -euo pipefail

###
# Print the md5 of a file, on Linux (CodeBuild) and macOS. Used as the fingerprint of a pipeline
# template: the ExportConfig stage compares it with the fingerprint the running pipeline was deployed
# with, and redeploys the pipeline when they differ.
#
# Usage: fingerprint.sh path/to/file

if command -v md5sum > /dev/null; then
  md5sum "$1" | awk '{print $1}'
else
  md5 -q "$1"
fi
