#!/bin/bash

####
# Send the deploy notification to Datadog
#
# variables must be set as environment variables in the pipeline

# if this is a PR inject a link
COMMIT_MSG=$(echo $COMMIT_MSG | sed "s~\(Merge pull request #\([0-9]*\)\)~[\1](https://github.com/$REPO/pull/\2)~g")

curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d @- << EOF
        {
          "alert_type": "success",
          "source_type_name": "amazon codebuild",
          "title": "$PRODUCT_NAME $PRODUCT_COMPONENT was deployed to $ENVIRONMENT",
          "text": "%%% \n[$COMMIT_ID](https://github.com/$REPO/commit/$COMMIT_ID) - $COMMIT_MSG\nBranch:$SRC_BRANCH\nEnvironment:$ENVIRONMENT\n\n $DEPLOY_MSG\n %%%",
          "tags": [
            "product:$PRODUCT_NAME",
            "component:$PRODUCT_COMPONENT",
            "action:deploy",
            "environment:$ENVIRONMENT"
          ]
        }
EOF
