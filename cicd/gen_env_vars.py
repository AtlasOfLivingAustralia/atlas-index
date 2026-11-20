#!/usr/bin/env python3

###
# Generate the environment vars file for the current environment.
# Usage: gen_env_vars.py --env [development|testing|staging|production] --clean-branch [branch] \
#                        --conf [/path/to/component/config.ini] [--conf /path/to/app/config.ini ...]
#
# cicd/config.ini is always read first; each --conf is layered on top in order, so a later file
# overrides an earlier one for the same section/key.

import os
import argparse
import configparser
import shlex

parser = argparse.ArgumentParser()

parser.add_argument("--env", "-e", help="The environment we are running in", required=True)
parser.add_argument("--conf", "-c", help="Path to a config file, may be repeated. Default: config.ini", action="append")
parser.add_argument("--clean-branch", "-cb", help="The clean branch name, used for resource naming", required=True)
parser.add_argument("--shell", help="Shell-quote values so the output can be sourced safely", action="store_true")

args = parser.parse_args()

config_defaults = {
                     'CLEAN_BRANCH' : args.clean_branch,
                     'ENVIRONMENT'  : args.env,
                     'AWS_ACCOUNT_ID' : os.popen('aws sts get-caller-identity --query Account --output text').read().strip()[:6]
                  }

config = configparser.ConfigParser(interpolation=configparser.ExtendedInterpolation())
# keep key case so VITE_* names survive unchanged; set before any key is added
config.optionxform = str
config.read_dict({'DEFAULT': config_defaults})

script_dir = os.path.dirname(os.path.realpath(__file__))
config.read([f'{script_dir}/config.ini'] + (args.conf or ['config.ini']))

env_config = config[args.env]

for key in env_config:
  value = env_config[key].replace("\n", "")
  print(f"{key.upper()}={shlex.quote(value) if args.shell else value}")
