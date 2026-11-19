#!/bin/bash
set -euo pipefail

###
# Deploy search-service to EKS with Helm, then smoke test it through its public hostname.
# Run from the repository root.
#
# The config is rendered here rather than in ExportConfig so the secret properties never reach a
# pipeline artifact: cicd/backend/search-service-config.properties.j2 + every key/value of the
# Secrets Manager JSON secret APP_SECRET_NAME -> a Kubernetes Secret (search-service/helm).
#
# Required env: the loaded config (env.sh), EKS_CLUSTER_NAME, ECR_REPO, BUILD_TAG, WAF_ARN

config=$(mktemp)
trap 'rm -f "$config"' EXIT

cicd/gen_template_config.py --template cicd/backend/search-service-config.properties.j2 > "$config"
aws secretsmanager get-secret-value --secret-id "$APP_SECRET_NAME" --query SecretString --output text \
  | jq -r 'to_entries[] | "\(.key)=\(.value)"' >> "$config"

aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME"

if [[ -n $SERVICE_ROLE_ARN ]]; then
  kubectl create serviceaccount "$SERVICE_ACCOUNT_NAME" -n "$EKS_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  kubectl annotate serviceaccount "$SERVICE_ACCOUNT_NAME" -n "$EKS_NAMESPACE" --overwrite \
    eks.amazonaws.com/role-arn="$SERVICE_ROLE_ARN"
  sa_args=(--set serviceAccount.name="$SERVICE_ACCOUNT_NAME")
else
  sa_args=()
fi

helm upgrade --install "$HELM_RELEASE_NAME" search-service/helm \
  --namespace "$EKS_NAMESPACE" \
  --set image.repository="$ECR_REPO" \
  --set image.tag="$BUILD_TAG" \
  --set environment="$ENVIRONMENT" \
  --set ingress.hostname="$SERVICE_HOST" \
  --set ingress.certificateArn="$APP_CERTIFICATE" \
  --set ingress.wafArn="$WAF_ARN" \
  --set-string ingress.tags="product=$PRODUCT_NAME\,component=search-service\,environment=$ENVIRONMENT\,branch=$CLEAN_BRANCH" \
  --set data.s3Uri="$DATA_S3_URI" \
  --set data.size="$DATA_VOLUME_SIZE" \
  --set resources.requests.cpu="$CPU_REQUEST" \
  --set resources.requests.memory="$MEMORY" \
  --set resources.limits.memory="$MEMORY" \
  --set-string deploymentAnnotations.commitHash="$CODEBUILD_RESOLVED_SOURCE_VERSION" \
  --set-file config="$config" \
  "${sa_args[@]}" \
  --wait --timeout 15m

# DNS (external-dns) and the load balancer can take a few minutes on the first deploy
echo "smoke test: $DEPLOY_URL/actuator/health"
for _ in $(seq 60); do
  if curl -sf "$DEPLOY_URL/actuator/health"; then
    echo; echo "search-service is healthy"; exit 0
  fi
  sleep 10
done
echo "search-service did not report healthy at $DEPLOY_URL/actuator/health"
exit 1
