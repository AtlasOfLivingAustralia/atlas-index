#!/bin/bash
set -euo pipefail

###
# Deploy search-service to EKS with Helm, then smoke test it through its public hostname.
# Run from the repository root.
#
# The config is rendered here rather than in ExportConfig so the credentials never reach a pipeline
# artifact: cicd/backend/search-service-config.properties.j2, then the credentials looked up below
# (database stack, base stack Cognito clients, shared Elasticsearch/RabbitMQ secrets) and every
# key/value of the Secrets Manager JSON secret APP_SECRET_NAME -> a Kubernetes Secret (search-service/helm).
#
# Required env: the loaded config (env.sh), AWS_REGION, EKS_CLUSTER_NAME, ECR_REPO, BUILD_TAG, WAF_ARN

config=$(mktemp)
ca_cert=$(mktemp)
trap 'rm -f "$config" "$ca_cert"' EXIT

stack_output() {
  aws cloudformation describe-stacks --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}
secret() {
  aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text
}

user_pool_id=$(stack_output "$COGNITO_STACK_NAME" UserPoolId)
OIDC_DISCOVERY_URI=https://cognito-idp.$AWS_REGION.amazonaws.com/$user_pool_id/.well-known/openid-configuration
OIDC_CLIENT_ID=$(stack_output "$BASE_STACK_NAME" AppClientId)
DATASOURCE_URL=jdbc:postgresql://$(stack_output "$DATABASE_STACK_NAME" ClusterEndpoint):5432/$(stack_output "$DATABASE_STACK_NAME" DatabaseName)
export OIDC_DISCOVERY_URI OIDC_CLIENT_ID DATASOURCE_URL
cicd/gen_template_config.py --template cicd/backend/search-service-config.properties.j2 > "$config"

service_client_id=$(stack_output "$BASE_STACK_NAME" ServiceClientId)
service_client_secret=$(aws cognito-idp describe-user-pool-client --user-pool-id "$user_pool_id" \
  --client-id "$service_client_id" --query UserPoolClient.ClientSecret --output text)
database=$(secret "$(stack_output "$DATABASE_STACK_NAME" SecretArn)")
rabbitmq=$(secret "$RABBITMQ_SECRET_NAME")
db_username=$(jq -er .username <<< "$database")
db_password=$(jq -er .password <<< "$database")
elastic_password=$(secret "$ELASTIC_SECRET_NAME" | jq -er .password)
rabbitmq_username=$(jq -er .username <<< "$rabbitmq")
rabbitmq_password=$(jq -er .password <<< "$rabbitmq")
extra=$(secret "$APP_SECRET_NAME" | jq -r 'to_entries[] | "\(.key)=\(.value)"')
cat >> "$config" << EOF
spring.datasource.username=$db_username
spring.datasource.password=$db_password
elastic.password=$elastic_password
rabbitmq.username=$rabbitmq_username
rabbitmq.password=$rabbitmq_password
webservice.client-id=$service_client_id
webservice.client-secret=$service_client_secret
$extra
EOF

aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME"

kubectl get secret "$ELASTIC_CA_SECRET" -n "$ELASTIC_NAMESPACE" -o jsonpath='{.data.ca\.crt}' | base64 -d > "$ca_cert"
[[ -s $ca_cert ]] || { echo "no ca.crt in secret $ELASTIC_NAMESPACE/$ELASTIC_CA_SECRET"; exit 1; }

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
  --set-file caCert="$ca_cert" \
  ${sa_args[@]+"${sa_args[@]}"} \
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
