#!/bin/bash

# Set default thread count if not provided as an argument
thread_count=${1:-10}

# Ensure this workspace's pinned playwright has its browsers available.
yarn playwright install

# Pick a random free TCP port in the ephemeral range, verifying it isn't
# already in use (retrying with a new random port if it is).
find_free_port() {
  local port
  while true; do
    port=$(( (RANDOM % 16383) + 49152 ))
    if ! lsof -i :$port > /dev/null 2>&1; then
      echo $port
      return
    fi
  done
}

APP_PORT=$(find_free_port)
export PLAYWRIGHT_APP_PORT=$APP_PORT
echo "Using app port $APP_PORT"

# static-server (port 8082) is not a real server in tests -- its content is
# served directly from disk via tests/mocks/staticServerMocks.ts's page.route
# interception, so .env.playwright's http://localhost:8082 URLs are left as-is.
#
# Override the app port baked into .env.playwright with the randomly selected
# one above. Vite prioritises real environment variables over .env files, so any
# VITE_* value in .env.playwright referencing localhost:5173 is superseded for
# this build.
apply_dynamic_ports() {
  local env_file=".env.playwright"
  [ -f "$env_file" ] || return
  while IFS= read -r line; do
    case "$line" in
      \#*|'') continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$value" in
      *localhost:5173*)
        value="${value//localhost:5173/localhost:$APP_PORT}"
        export "$key=$value"
        ;;
    esac
  done < "$env_file"
}
apply_dynamic_ports

set -e

COLLECTIONS_SRC="./src/api/sources/collections.json"
COLLECTIONS_BACKUP="./src/api/sources/collections.json.bak"
COLLECTIONS_PLAYWRIGHT="./tests/resources/collections.json"

ENV_LOCAL=".env.local"
ENV_LOCAL_BACKUP=".env.local.bak"

ENV_LOCAL=".env.local"
ENV_LOCAL_BACKUP=".env.local.bak"
ENV_PRODUCTION=".env.production"
ENV_PRODUCTION_BACKUP=".env.production.bak"

echo "Swapping in playwright-specific collections.json for build..."
cp "$COLLECTIONS_SRC" "$COLLECTIONS_BACKUP"
cp "$COLLECTIONS_PLAYWRIGHT" "$COLLECTIONS_SRC"

# Temporarily hide .env.local and .env.production so they don't bleed into the playwright build
if [ -f "$ENV_LOCAL" ]; then
  echo "Hiding .env.local for playwright build..."
  mv "$ENV_LOCAL" "$ENV_LOCAL_BACKUP"
fi
if [ -f "$ENV_PRODUCTION" ]; then
  echo "Hiding .env.production for playwright build..."
  mv "$ENV_PRODUCTION" "$ENV_PRODUCTION_BACKUP"
fi

# Ensure the original files are restored even if the build or tests fail
restore_files() {
  if [ -f "$COLLECTIONS_BACKUP" ]; then
    mv "$COLLECTIONS_BACKUP" "$COLLECTIONS_SRC"
  fi
  if [ -f "$ENV_LOCAL_BACKUP" ]; then
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL"
  fi
  if [ -f "$ENV_PRODUCTION_BACKUP" ]; then
    mv "$ENV_PRODUCTION_BACKUP" "$ENV_PRODUCTION"
  fi
}
trap restore_files EXIT

echo "Building the project..."
yarn run build:playwright

echo "Restoring env files..."
restore_files

# Clear previous coverage data
echo "Clearing previous coverage data..."
rm -rf .nyc_output

# Start the app server in the background
echo "Starting the app server..."
yarn vite preview --port $APP_PORT --strictPort &
APP_SERVER_PID=$!

# Wait for the server to start
sleep 5

cleanup() {
  # Teardown server
  echo "Stopping server..."
  kill $APP_SERVER_PID
  # Restore original files (also handles any early exit before explicit restore)
  restore_files
}
trap cleanup EXIT

# Run Playwright tests
echo "Running Playwright tests with $thread_count workers..."
CI=true yarn playwright test --workers=$thread_count --reporter=dot
# Headed mode tests, uncomment the line below to use it
#yarn playwright test --workers=$thread_count --reporter=dot

# Report coverage
echo ""
echo "Coverage report:"
yarn nyc report --reporter=text --reporter=lcov --include='src/**' --exclude='src/buildInfo.json' 2>/dev/null || true

