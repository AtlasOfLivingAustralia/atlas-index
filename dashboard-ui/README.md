# Dashboard UI

A UI replacement for the dashboard app.

This app depends on data produced by the search-service.

Built with:

- React
- TypeScript
- Bootstrap 5
- Node version v18.12.1
- Yarn version v1.22.10 (brew install yarn)

## Getting started

### Config

- For ALA development, refer to [this](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/dashboard-ui) configuration and deployment information.
- For all other use, see the [Environment variables](#environment-variables) section below and create your own `.env.local` file.

### Preparing data

Use [search-service](../search-service) to generate the data found at VITE_APP_DASHBOARD_DATA_URL, VITE_APP_DASHBOARD_ZIP_URL.

Example files:

- For example files, see the [static-server/static/dashboard](../static-server/static/dashboard) project directory.
- Serve these locally using the [static-server](../static-server) project.

### Run locally

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn test
yarn run build
```

## Environment variables

The following environment variables are used:

```properties
# general config
VITE_HOME_URL=https://ala.org.au
VITE_LOGIN_URL=https://userdetails.test.ala.org.au/myprofile
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png
VITE_AUTH_COOKIE=ALA-Auth-Test=
VITE_AUTH_COOKIE_DOMAIN=

# other services
VITE_APP_BIOCACHE_URL=https://biocache-ws-test.ala.org.au/ws

# dashboard data sources (see examples in ../static-server/static/dashboard)
VITE_APP_DASHBOARD_DATA_URL=http://localhost:8082/static/dashboard/dashboard.json
VITE_APP_DASHBOARD_ZIP_URL=http://localhost:8082/static/dashboard/dashboard.zip

# common header, footer, css, js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/banner.mustache
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.mustache
VITE_COMMON_CSS=http://localhost:8082/static/common/ala-combined.css
VITE_COMMON_JS=http://localhost:8082/static/common/ala-combined.js
VITE_COMMON_CONTAINER_CLASS=container-fluid
VITE_SEARCH_URL_PREFIX=https://bie.test.ala.org.au
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=dashboard

VITE_ENV=local
```
## Playwright UI tests

You may need to run ```yarn install``` to update nodejs libs;

And run ``` npx playwright install```. ```npx playwright test --init ``` may not work. It is outdated.

```npx playwright test --ui``` will let you run test with its UI

## Playwright tests
Playwright tests are included to verify basic functionality. Running in headless mode by default. To run the tests:
```bash
./run-playwright-test.sh [workers, default 10]
```
This script will start a local static server to serve common files and the regionsList.json file, then run the tests against a locally running regions-ui instance that is built to use `.env.playwright` for config.
- If using a different method, ensure you are using the same config as in `.env.playwright`. See `run-playwright-test.sh` for all environment details.
- If using playwright ui mode,
    - start static-server (after running `run-playwright-test.sh` once to copy the required files)
    - copy `.env.playwright` to `.env.local`
    - prepare dashboard.json. `cp ./tests/resources/dashboard.json ../static-server/static/dashboard/dashboard.json`
    - prepare dashboard.zip . `cp ./tests/resources/dashboard.zip ../static-server/static/dashboard/dashboard.zip`
    - start in dev mode `yarn run dev` so that any changes to the app apply immediately
    - then start ui mode `yarn playwright test --ui`, any changes to the tests will apply immediately
