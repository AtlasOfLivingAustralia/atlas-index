#!/bin/bash
set -euo pipefail

###
# Print the UI's Vite build config (.env.production) for the current environment: every VITE_* key
# from cicd/config.ini + cicd/frontend/config.ini + cicd/frontend/$UI_APP/config.ini.
# A value of the form secretsmanager:<secret-id>:<json-key> is resolved here, at build time.
#
# Required env: ENVIRONMENT, CLEAN_BRANCH, UI_APP

cicd/gen_env_vars.py --env "$ENVIRONMENT" --clean-branch "$CLEAN_BRANCH" \
    --conf cicd/frontend/config.ini --conf "cicd/frontend/$UI_APP/config.ini" \
  | grep '^VITE_' \
  | while IFS= read -r line; do
      key=${line%%=*}
      value=${line#*=}
      if [[ $value == secretsmanager:* ]]; then
        IFS=: read -r _ secret_id json_key <<< "$value"
        value=$(aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text \
                  | jq -er --arg k "$json_key" '.[$k]')
      fi
      printf '%s=%s\n' "$key" "$value"
    done
