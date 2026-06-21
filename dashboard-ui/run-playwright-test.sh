#!/bin/bash

# Set default thread count if not provided as an argument
thread_count=${1:-10}

# Function to check if a process is running on a specific port
check_port() {
  if lsof -i :$1 > /dev/null; then
    echo "Error: A process is already running on port $1. Please stop it and try again. (e.g. pkill -f http-server)"
    exit 1
  fi
}

# Check if ports 8082 or 5173 are in use. Using test specific ports instead of the defaults would be better.
check_port 8082
check_port 5173

# Exit on error
set -e

ENV_LOCAL=".env.local"
ENV_LOCAL_BACKUP=".env.local.bak"
ENV_PRODUCTION=".env.production"
ENV_PRODUCTION_BACKUP=".env.production.bak"

# Temporarily hide .env.local and .env.production so they don't bleed into the playwright build
if [ -f "$ENV_LOCAL" ]; then
  echo "Hiding .env.local for playwright build..."
  mv "$ENV_LOCAL" "$ENV_LOCAL_BACKUP"
fi
if [ -f "$ENV_PRODUCTION" ]; then
  echo "Hiding .env.production for playwright build..."
  mv "$ENV_PRODUCTION" "$ENV_PRODUCTION_BACKUP"
fi

restore_env_local() {
  if [ -f "$ENV_LOCAL_BACKUP" ]; then
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL"
  fi
  if [ -f "$ENV_PRODUCTION_BACKUP" ]; then
    mv "$ENV_PRODUCTION_BACKUP" "$ENV_PRODUCTION"
  fi
}
trap restore_env_local EXIT

echo "Building the project..."
yarn run build:playwright

echo "Restoring env files..."
restore_env_local

echo "Copy dashboard.json to static-server"
cp ./tests/resources/dashboard.json ../static-server/static/dashboard/dashboard.json

echo "Copy dashboard.zip to static-server"
cp ./tests/resources/dashboard.zip ../static-server/static/dashboard/dashboard.zip

# Start the app server in the background
echo "Starting the app server..."
http-server ./dist -p 5173 --cors --proxy "http://localhost:5173?" --silent &
APP_SERVER_PID=$!

# Start the static server in the background
echo "Starting the static server..."
http-server ../static-server -p 8082 --cors --silent &
STATIC_SERVER_PID=$!

# Wait for servers to start
sleep 5

cleanup() {
  # Teardown servers
  echo "Stopping servers..."
  kill $APP_SERVER_PID $STATIC_SERVER_PID
  restore_env_local
}
trap cleanup EXIT

# Run Playwright tests
echo "Running Playwright tests with $thread_count workers..."
yarn playwright test --workers=$thread_count --reporter=dot
# Headed mode tests, uncomment the line below to use it
#yarn playwright test --workers=1 --reporter=dot --headed


