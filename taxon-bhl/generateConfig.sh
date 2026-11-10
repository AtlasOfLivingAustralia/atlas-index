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
if ! secret=$(aws secretsmanager get-secret-value \
    --secret-id "atlas-index-bhl-api-key" \
    --query SecretString \
    --output text); then
    echo "Failed to fetch the BHL API key from AWS Secrets Manager." >&2
    exit 1
fi
if ! BHL_API_KEY=$(printf '%s' "$secret" | jq -er '.BHL_API_KEY | select(type == "string" and length > 0)'); then
    echo "The secret must contain a nonempty BHL_API_KEY string." >&2
    exit 1
fi
export BHL_API_KEY

# 2. Substitute the variable to generate the real config file
envsubst '$BHL_API_KEY' < config.template.json > config.json