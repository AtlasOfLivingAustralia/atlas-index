#!/bin/bash

####
# Send the deploy notification to Slack
#
# variables must be set as environment variables in the pipeline 

# Some fun, a different image for each environment
case $ENVIRONMENT in
  "production")
    IMAGE_URL=https://inaturalist-open-data.s3.amazonaws.com/photos/217598153/small.jpg
    ALT_TEXT="Photo by Luke Verburgt. https://www.inaturalist.org/observations/128122758?photo_id=217598153"
    ;;
  "staging")
    IMAGE_URL=https://inaturalist-open-data.s3.amazonaws.com/photos/105240078/small.jpeg
    ALT_TEXT="Photo by debtaylor142. https://www.inaturalist.org/observations/65390388?photo_id=105240078"
    ;;
  "testing")
    IMAGE_URL=https://inaturalist-open-data.s3.amazonaws.com/photos/158345804/small.jpeg
    ALT_TEXT="Photo by John Bromilow. https://www.inaturalist.org/observations/95384091"
    ;;
  *)
    IMAGE_URL=https://inaturalist-open-data.s3.amazonaws.com/photos/423200057/small.jpeg
    ALT_TEXT="Photo by caliologist. https://www.inaturalist.org/observations/237589402"
    ;;
esac

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
case $AWS_ACCOUNT_ID in
  "736913556139")
    AWS_ACCOUNT_NAME="Production"
    ;;
  "748909248546")
    AWS_ACCOUNT_NAME="Testing"
    ;;
  "731167336288")
    AWS_ACCOUNT_NAME="Development"
    ;;
  *)
    AWS_ACCOUNT_NAME="Unknown ($AWS_ACCOUNT_ID)"
    ;;
esac

# if this is a PR inject a link
COMMIT_MSG=$(printf '%s' "$COMMIT_MSG" | sed "s~\(Merge pull request #\([0-9]*\)\)~<https://github.com/$REPO/pull/\2|\1>~g")
export COMMIT_MSG IMAGE_URL ALT_TEXT AWS_ACCOUNT_NAME

# jq reads the values from env and encodes them, so quotes or backslashes can't break the JSON
jq -n '{
    "channel": env.SLACK_ALERT_CHANNEL,
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "\(env.AWS_ACCOUNT_NAME) account - \(env.PRODUCT_COMPONENT) \(env.ENVIRONMENT) release",
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Branch:*\n<https://github.com/\(env.REPO)/tree/\(env.SRC_BRANCH)|\(env.SRC_BRANCH)>\n*Environment:*\n\(env.ENVIRONMENT)\n"
        },
        "accessory": {
          "type": "image",
          "image_url": env.IMAGE_URL,
          "alt_text": env.ALT_TEXT
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Commit message:*\n\(env.COMMIT_MSG) - <https://github.com/\(env.REPO)/commit/\(env.COMMIT_ID)|\(env.COMMIT_ID)>"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": env.DEPLOY_MSG
        }
      }
   ]
  }' | curl -X POST "https://slack.com/api/chat.postMessage" \
  -H "Content-type: application/json; charset=utf-8" \
  -H "Authorization: Bearer $SLACK_OAUTH_TOKEN" \
  -d @-
