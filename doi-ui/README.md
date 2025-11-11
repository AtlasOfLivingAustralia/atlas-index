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

## Environment variables

The following environment variables are used:

```properties
# general config
VITE_HOME_URL=https://ala.org.au
VITE_LOGIN_URL=https://userdetails.ala.org.au/myprofile
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png
VITE_AUTH_COOKIE=ALA-Auth-Test-Local=
VITE_AUTH_COOKIE_DOMAIN=localhost
VITE_ENV=local

# other services
VITE_APP_BIOCACHE_URL=https://biocache-ws.ala.org.au/ws
VITE_APP_BASE_URL=http://localhost:5173
VITE_APP_DOI_UI_URL=http://localhost:5173
VITE_APP_API_URL=http://localhost:8081
VITE_APP_DOI_URL=http://localhost:8081/v1
VITE_APP_DOI_RESOLVER=https://api.test.datacite.org/
VITE_APP_ROLE_ADMIN=ROLE_ADMIN

# minimal header and footer urls
VITE_CONTACT_URL=https://www.ala.org.au/contact-us/
VITE_CREATE_ACCOUNT_URL=https://userdetails.ala.org.au/registration/createAccount
# common header, footer, css and js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/header.html
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.html
VITE_COMMON_CSS=http://localhost:8082/static/common/common.css
VITE_COMMON_JS=http://localhost:8082/static/common/common.js
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=doi
```
