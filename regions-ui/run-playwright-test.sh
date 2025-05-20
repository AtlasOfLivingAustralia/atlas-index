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

echo "Building the project..."
yarn run build:playwright

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
}
trap cleanup EXIT

# Run Playwright tests
echo "Running Playwright tests with $thread_count workers..."
yarn playwright test --workers=$thread_count --reporter=dot
