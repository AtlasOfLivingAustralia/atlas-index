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

Use [search-service](../search-service) to generate the data found at VITE_APP_DASHBOARD_DATA_URL, VITE_APP_DASHBOARD_ZIP_URL and VITE_APP_DASHBOARD_I18N_URL.

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
VITE_NAMEMATCHING_WS=https://namematching-ws.ala.org.au
VITE_SPECIES_URL_PREFIX=https://bie.ala.org.au/species/

# dashboard data sources (see examples in ../static-server/static/dashboard)
VITE_APP_DASHBOARD_DATA_URL=http://localhost:8082/static/dashboard/dashboard.json
VITE_APP_DASHBOARD_ZIP_URL=http://localhost:8082/static/dashboard/dashboard.zip
VITE_APP_DASHBOARD_I18N_URL=http://localhost:8082/static/dashboard/dashboardI18n.json

# minimal header and footer urls
VITE_CONTACT_URL=https://www.ala.org.au/contact-us/
VITE_CREATE_ACCOUNT_URL=https://userdetails.test.ala.org.au/registration/createAccount

# common header, footer, css, js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/header.html
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.html
VITE_COMMON_CSS=http://localhost:8082/static/common/common.css
VITE_COMMON_JS=http://localhost:8082/static/common/common.js
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=dashboard

VITE_ENV=local
```
