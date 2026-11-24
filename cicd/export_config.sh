#!/bin/bash

###
# Shared body of every component's ExportConfig action. It must be *sourced* by the buildspec so the
# loaded config stays in the build shell, where the buildspec's exported-variables can pick it up.
#
# Required env (set by the pipeline): ENVIRONMENT CLEAN_BRANCH PRODUCT_COMPONENT SRC_BRANCH
#                                     PIPELINE_FINGERPRINT CODEBUILD_BUILD_NUMBER COMMIT_ID
# Optional env:                       UI_APP (frontend pipelines only)
#
# 1. loads cicd/config.ini + cicd/$PRODUCT_COMPONENT/config.ini (+ cicd/frontend/$UI_APP/config.ini)
#    and writes it to env.sh (shell-quoted) for later actions
# 2. refuses to continue while any loaded value still marks an open decision gate (TODO-DG)
# 3. redeploys the pipeline when its definition changed, then stops this execution: a normal deploy
#    restarts itself on update, a rollback is started on its commit by deploy_pipeline.sh
#
# Template configs are rendered afterwards by cicd/render_template_configs.sh.

conf_args=(--conf "cicd/$PRODUCT_COMPONENT/config.ini")
[[ -n "${UI_APP:-}" ]] && conf_args+=(--conf "cicd/$PRODUCT_COMPONENT/$UI_APP/config.ini")

cicd/gen_env_vars.py --shell --env "$ENVIRONMENT" --clean-branch "$CLEAN_BRANCH" "${conf_args[@]}" > env.sh || exit 1

if grep -n 'TODO-DG' env.sh; then
  echo "The open decision gate(s) above must be resolved in cicd/**/config.ini before deploying, see cicd/README.md"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source env.sh
set +a

current_fingerprint=$(cicd/fingerprint.sh "cicd/$PRODUCT_COMPONENT/pipeline/pipeline.yaml")
if [[ "$PIPELINE_FINGERPRINT" != "$current_fingerprint" ]]; then
  echo "existing pipeline is out of sync with current code revision, relaunching!"
  deploy_args=(-c "$PRODUCT_COMPONENT" -e "${ENVIRONMENT:0:4}" -b "$SRC_BRANCH")
  [[ -n "${UI_APP:-}" ]] && deploy_args+=(-u "$UI_APP")
  cicd/deploy_pipeline.sh "${deploy_args[@]}"
  exit 1
fi
echo "existing pipeline is in sync with current code revision, proceeding with the deploy!"
