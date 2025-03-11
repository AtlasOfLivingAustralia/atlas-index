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

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn run build
```

## Preparing data

Use search-service to gernate the 

## Environment variables

The following environment variables are used:

```properties
# general config
VITE_HOME_URL=https://ala.org.au
VITE_OIDC_AUTH_PROFILE=https://userdetails.test.ala.org.au/myprofile
VITE_LOGIN_URL=https://userdetails.test.ala.org.au
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png
VITE_AUTH_COOKIE=ALA-Auth-Test=
VITE_AUTH_COOKIE_DOMAIN=.ala.org.au

# other services
VITE_APP_BIOCACHE_URL=https://biocache-ws-test.ala.org.au/ws
VITE_NAMEMATCHING_WS=https://namematching-ws.ala.org.au
VITE_SPECIES_URL_PREFIX=https://bie.ala.org.au/species/

# dashboard data sources (see examples in ../static-server/static/dashboard)
VITE_APP_DASHBOARD_DATA_URL=https://ala-index.dev.ala.org.au/static/dashboard/dashboard.json
VITE_APP_DASHBOARD_ZIP_URL=https://ala-index.dev.ala.org.au/static/dashboard/dashboard.zip
VITE_APP_DASHBOARD_I18N_URL=https://ala-index.dev.ala.org.au/static/dashboard/dashboardI18n.json

# minimal header and footer urls
VITE_CONTACT_URL=https://www.ala.org.au/contact-us/
VITE_CREATE_ACCOUNT_URL=https://userdetails.test.ala.org.au/registration/createAccount
```
