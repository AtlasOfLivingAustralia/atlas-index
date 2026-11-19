#!/bin/bash
set -euo pipefail

###
# Render cicd/$PRODUCT_COMPONENT/app/<stack>_template_config.json for every <stack>.yaml from the
# current environment (template values are the lower-cased environment variable names).

for template in cicd/"$PRODUCT_COMPONENT"/app/*.yaml; do
  stack=${template%.yaml}
  echo "Generating the template config for $stack"
  cicd/gen_template_config.py --template "${stack}_template_config.j2" > "${stack}_template_config.json"
done
