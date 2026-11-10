# Check if the necessary AWS login environment variables are set.
# (Adjust 'AWS_ACCESS_KEY_ID' or 'AWS_PROFILE' to match whatever your login script sets)
if [ -z "${AWS_ACCESS_KEY_ID}" ] && [ -z "${AWS_PROFILE}" ]; then
    echo "AWS login not found. Please run \`test-login\` or \`prod-login\` first"
    exit 1
fi

# Check if 'jq' is installed
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install jq first."
    exit 1
fi

# 1. Fetch secret from AWS and export to ENV
export BHL_API_KEY=$(aws secretsmanager get-secret-value \
    --secret-id "atlas-index-bhl-api-key" \
    --query SecretString \
    --output text | jq -r '.BHL_API_KEY')

# 2. Substitute the variable to generate the real config file
envsubst '$BHL_API_KEY' < config.template.json > config.json