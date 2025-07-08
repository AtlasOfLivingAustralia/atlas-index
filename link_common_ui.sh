#!/bin/sh

# Link common-ui globally
if [ -d common-ui ]; then
  cd common-ui && yarn link && cd ..
else
  echo "Directory common-ui does not exist."
  exit 1
fi

# List of UI projects to link
for dir in admin-ui regions-ui dashboard-ui specimens-ui search-ui; do
  if [ -d "$dir" ]; then
    cd "$dir" && echo "linking $dir" && yarn link @ala/common-ui && cd ..
  else
    echo "Directory $dir does not exist, skipping."
  fi
done
