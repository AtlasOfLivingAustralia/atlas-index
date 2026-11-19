#!/bin/bash
set -ueo pipefail

###
# Deploy (create or update) the CodePipeline stack for one component.
# You must have AWS CLI credentials for the target account.
#
# Usage: cicd/deploy_pipeline.sh -c <component> [-u <ui>] [-e prod] [-b <branch>]
#   -c  component, a directory under cicd/: base | frontend | backend
#   -u  the UI workspace, required for the frontend component (e.g. search-ui)
#   -e  must be "prod" to deploy production from main/master
#   -b  branch override, used when not on a branch (detached head, e.g. inside CodeBuild)
#
# The pipeline for an environment is chosen from the branch, see branch_2_env.py.

usage() {
  sed -n '4,13p' "$0"
}

ENV=nonprod
BRANCH_OVERRIDE=
COMPONENT=
UI_APP=
SCRIPT_DIR=$(dirname "$(realpath "$0")")

while getopts "c:u:e:b:" flag; do
  case $flag in
    c) COMPONENT=$OPTARG ;;
    u) UI_APP=$OPTARG ;;
    e) ENV=$OPTARG ;;
    b) BRANCH_OVERRIDE=$OPTARG ;;
    \?) usage; exit 1 ;;
  esac
done

PIPELINE_TEMPLATE=$SCRIPT_DIR/$COMPONENT/pipeline/pipeline.yaml
if [[ -z $COMPONENT || ! -f $PIPELINE_TEMPLATE ]]; then
  echo "Unknown component '$COMPONENT'"; usage; exit 1
fi
CONF_ARGS=(--conf "$SCRIPT_DIR/$COMPONENT/config.ini")
if [[ $COMPONENT == frontend ]]; then
  if [[ -z $UI_APP || ! -f $SCRIPT_DIR/frontend/$UI_APP/config.ini ]]; then
    echo "The frontend component needs -u <ui> with a matching cicd/frontend/<ui>/config.ini"; exit 1
  fi
  CONF_ARGS+=(--conf "$SCRIPT_DIR/frontend/$UI_APP/config.ini")
fi

branch=$(git branch --show-current)

# confirm which environment we're deploying to if it wasnt explicitly set
if [[ ( "$branch" == "main" || "$branch" == "master" ) && "$ENV" == "nonprod" ]]; then
  echo "Deploy to production or staging?"
  echo "1) production"
  echo "2) staging"
  read -r -p "Enter your choice (1 or 2): " choice
  [[ $choice == 1 ]] && ENV="prod"
fi

# check if we're on a detached head
if [[ -n $branch ]]; then
  real_branch=1
elif [[ -n $BRANCH_OVERRIDE ]]; then
  real_branch=0
  branch=$BRANCH_OVERRIDE
else
  echo "You must specify a branch override or run this script from a git branch"
  exit 1
fi
echo branch: "$branch"

COMMIT_ID=$(git rev-parse HEAD)
echo commit id: "$COMMIT_ID"
LATEST_COMMIT_ID=$(git log -n 1 --pretty=format:"%H" "$branch")

# when releasing an older commit (rollback) the pipeline must not restart itself on the latest commit
if [[ "$COMMIT_ID" != "$LATEST_COMMIT_ID" ]]; then
  echo "latest commit is $LATEST_COMMIT_ID but we are releasing $COMMIT_ID, this is a rollback"
  RESTART_PIPELINE_ON_UPDATE=false
else
  RESTART_PIPELINE_ON_UPDATE=true
fi

if [[ $real_branch -eq 1 ]]; then
  if [[ -n "$(git status --porcelain)" ]] \
     || ! git ls-remote --exit-code origin "$branch" > /dev/null 2>&1 \
     || [[ -n "$(git diff "$branch" "origin/$branch")" ]]; then
    echo "changes must be committed and pushed before deploying"
    exit 1
  fi
fi

clean_branch=$("$SCRIPT_DIR/clean_branch.sh" "$branch")
echo clean branch: "$clean_branch"

environment=$("$SCRIPT_DIR/branch_2_env.py" --branch "$branch" --env "$ENV")
echo environment: "$environment"

# load the environment config
env_file=$(mktemp)
"$SCRIPT_DIR/gen_env_vars.py" --shell --env "$environment" --clean-branch "$clean_branch" "${CONF_ARGS[@]}" > "$env_file"
set -a
# shellcheck disable=SC1090
source "$env_file"
set +a
rm "$env_file"

PIPELINE_FINGERPRINT=$("$SCRIPT_DIR/fingerprint.sh" "$PIPELINE_TEMPLATE")

PARAMS=(
  pAllowTeardown="$ALLOW_TEARDOWN"
  pAutoDeploy="$AUTO_DEPLOY"
  pBaseStackName="$BASE_STACK_NAME"
  pBootstrapStackName="$BOOTSTRAP_STACK_NAME"
  pBucketsStackName="$BUCKETS_STACK_NAME"
  pCleanBranch="$clean_branch"
  pEnvironment="$environment"
  pGitHubBranch="$branch"
  pGitHubOwner="$GITHUB_OWNER"
  pGitHubRepositoryName="$GITHUB_REPO_NAME"
  pPipelineFingerprint="$PIPELINE_FINGERPRINT"
  pProductComponent="$PRODUCT_COMPONENT"
  pProductName="$PRODUCT_NAME"
  pRestartExecutionOnUpdate="$RESTART_PIPELINE_ON_UPDATE"
)
case $COMPONENT in
  base)
    PARAMS+=(pUsEast1CodePipelineArtifactBucketName="$US_EAST_ARTIFACT_BUCKET")
    ;;
  frontend)
    PARAMS+=(pUiApp="$UI_APP")
    ;;
  backend)
    PARAMS+=(pRegolithStackName="$REGOLITH_STACK_NAME")
    ;;
esac

echo "Deploying the pipeline template to $PIPELINE_STACK_NAME"
aws cloudformation deploy \
    --template-file "$PIPELINE_TEMPLATE" \
    --stack-name "$PIPELINE_STACK_NAME" \
    --tags product="$PRODUCT_NAME" component=cicd environment="$environment" branch="$branch" version="$COMMIT_ID" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    --parameter-overrides "${PARAMS[@]}"
