# Specimens UI

A UI replacement for the specimens app.

Built with:
- React
- TypeScript
- Bootstrap 5
- Node version v18.12.1
- Yarn version v1.22.10

## Getting started

### List of collections to include

The list of collections to include in the regions UI is defined in `./public/collections.json`. As part of the build
process, this file is used to generate a `./src/api/sources/collections.json` by fetching the collection metadata from
`.env.production:VITE_APP_COLLECTIONS_URL` and based on the `collections.json` file.

The `./src/api/sources/collections.json` file is not rebuilt if it already exists, so if you change the
`./public/collections.json` file, you also need to delete `./src/api/sources/collections.json`.

### ALA environment

Refer to [this](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/specimens-ui) configuration and deployment information.

### Local development

Run `node buildCollections.js` to generate the `./src/api/sources/collections.json` file from the `./public/collections.json` file. It
uses `.env.production:VITE_APP_COLLECTIONS_URL`.

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
VITE_APP_BIOCACHE_UI_URL=https://biocache.ala.org.au
VITE_APP_IMAGES_URL=https://images.ala.org.au

# minimal header and footer urls
VITE_CONTACT_URL=https://www.ala.org.au/contact-us/
VITE_CREATE_ACCOUNT_URL=https://userdetails.ala.org.au/registration/createAccount
# common header, footer, css and js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/header.html
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.html
VITE_COMMON_CSS=http://localhost:8082/static/common/common.css
VITE_COMMON_JS=http://localhost:8082/static/common/common.js
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=specimens
```

