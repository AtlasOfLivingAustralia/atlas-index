#!/bin/bash

###
# Sanitise a git branch name so that it can be used in AWS resource and stack names
#
# e.g. feature/Create_new_logo! will be changed to create-new-logo

SRC_BRANCH=$1

echo -n $SRC_BRANCH | sed 's/^feature\///' | sed 's/[/_]/-/g' | sed 's/[^a-zA-Z0-9-]//g' | tr '[:upper:]' '[:lower:]' | cut -c 1-30 | sed -E 's/[^a-z0-9]+$//'
