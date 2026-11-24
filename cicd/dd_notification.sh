#!/bin/bash

####
# Send the deploy notification to Datadog
#
# variables must be set as environment variables in the pipeline

# if this is a PR inject a link
COMMIT_MSG=$(printf '%s' "$COMMIT_MSG" | sed "s~\(Merge pull request #\([0-9]*\)\)~[\1](https://github.com/$REPO/pull/\2)~g")
export COMMIT_MSG

# jq reads the values from env and encodes them, so quotes or backslashes can't break the JSON
jq -n '{
  "alert_type": "success",
  "source_type_name": "amazon codebuild",
  "title": "\(env.PRODUCT_NAME) \(env.PRODUCT_COMPONENT) was deployed to \(env.ENVIRONMENT)",
  "text": "%%% \n[\(env.COMMIT_ID)](https://github.com/\(env.REPO)/commit/\(env.COMMIT_ID)) - \(env.COMMIT_MSG)\nBranch:\(env.SRC_BRANCH)\nEnvironment:\(env.ENVIRONMENT)\n\n \(env.DEPLOY_MSG)\n %%%",
  "tags": [
    "product:\(env.PRODUCT_NAME)",
    "component:\(env.PRODUCT_COMPONENT)",
    "action:deploy",
    "environment:\(env.ENVIRONMENT)"
  ]
}' | curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d @-
