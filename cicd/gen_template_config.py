#!/usr/bin/env python3

###
# Generate the template configuration, used to pass in the parameters to the
# CloudFormation template and add aws resource tags
# Usage: gen_template_config.py --template [/path/to/template_config.json]

import argparse
import os
import jinja2

parser = argparse.ArgumentParser()

parser.add_argument("--template", "-t", help="The j2 template", required=True)

args = parser.parse_args()

# load the j2 template
template_loader = jinja2.FileSystemLoader(searchpath="./")
template_env = jinja2.Environment(loader=template_loader)
template = template_env.get_template(args.template)

template_vals = {}

# template values are created as lower case versions of environment variables
for key, value in os.environ.items():
    template_vals[key.lower()] = value

# do the substitution
output_text = template.render(template_vals)

print(output_text)