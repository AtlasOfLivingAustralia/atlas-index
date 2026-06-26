# DOI UI

A UI replacement for the DOI app. Uses Search-service as a backend.

## Getting started

### ALA environment

Refer to [this](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/doi-ui) configuration and deployment information.

### Local development

```bash
node buildCollections.js
```

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
yarn run build
```

## .env.local configuration

An example configuration file is provided at `./env.local.example` for local development. 

Before use:
- Run atlas-index/search-service on 8081
- Enter the dependency URLs where required, e.g. `VITE_SEARCH_URL_PREFIX=<bie-url>`
