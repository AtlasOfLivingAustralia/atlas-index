#!/usr/bin/env python3

###
# convert the current code branch to an environment, used to load the appropriate environment vars
# Usage: ./branch_2_env.py --branch [code-branch] --env [environment]
#
# develop        -> testing     (auto deploys on push)
# main/master    -> staging, or production when --env prod
# anything else  -> development (per-branch stacks)

import argparse
import re

parser = argparse.ArgumentParser()

parser.add_argument("--branch", "-b", help="The code branch that triggered this build", required=True)
parser.add_argument("--env",    "-e", help="Environment", required=False, default='non-prod')

args = parser.parse_args()

if re.search('^main$|^master$', args.branch) and args.env == 'prod':
  print('production')
elif re.search('^main$|^master$', args.branch):
  print('staging')
elif re.search('^develop$', args.branch):
  print('testing')
else:
  print('development')
