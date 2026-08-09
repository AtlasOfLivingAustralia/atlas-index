# Occurrence UI

A UI replacement for biocache-hubs, ala-hub, avh-hub, ozcam-hub apps and relevant plugins.

## Getting started

### ALA environment

Refer to [this](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/occurrence-ui) configuration and deployment information.

### Local development

An example configuration file is provided at `./env.local.example` for local development. Copy to `.env.local` and update the values as required.

### Install dependencies and run the development server

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn install
# copy replace the src/config/*.json files with the appropriate environment json files for the home page summary and featured sections
yarn test
yarn playwright install --with-deps
./run-playwright-tests.sh
yarn run build
```
