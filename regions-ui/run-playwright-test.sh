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

restore_files() {
  if [ -f ".env.local.bak" ]; then
    mv ".env.local.bak" ".env.local"
  fi
  if [ -f ".env.production.bak" ]; then
    mv ".env.production.bak" ".env.production"
  fi
}
trap restore_files EXIT

# Temporarily hide .env.local and .env.production so they don't bleed into the playwright build
[ -f ".env.local" ]      && mv ".env.local"      ".env.local.bak"
[ -f ".env.production" ] && mv ".env.production" ".env.production.bak"

echo "Building the project..."
yarn run build:playwright

restore_files

# Clear previous coverage data
rm -rf .nyc_output

echo "Copy regionsList.json to dist"
cp ./tests/resources/regionsList.json ./dist/regionsList.json

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
  restore_files
}
trap cleanup EXIT

# Run Playwright tests
echo "Running Playwright tests with $thread_count workers..."
CI=true yarn playwright test --workers=$thread_count --reporter=dot

# Report coverage
echo ""
echo "Coverage report:"
yarn nyc report --reporter=text --reporter=lcov --include='src/**' 2>/dev/null || true
