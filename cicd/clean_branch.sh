#!/bin/bash

###
# Sanitise a git branch name so that it can be used in AWS resource and stack names
#
# e.g. feature/Create_new_logo! will be changed to create-new-logo

SRC_BRANCH=$1

# at most 26 characters: the longest name built from it, the backend Helm release
# (atlas-index-search-service-<branch>), must fit Helm's 53
clean=$(echo -n "$SRC_BRANCH" | sed 's/^feature\///' | sed 's/[/_]/-/g' | sed 's/[^a-zA-Z0-9-]//g' | tr '[:upper:]' '[:lower:]' | cut -c 1-26 | sed -E 's/[^a-z0-9]+$//')

# development resources are named after the clean branch, shared environments after the environment
case $clean in
  testing | staging | production)
    echo "branch '$SRC_BRANCH' becomes '$clean', which would clash with the $clean environment's resources; rename the branch" >&2
    exit 1 ;;
esac
echo -n "$clean"
