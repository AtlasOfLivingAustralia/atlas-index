# Regions UI

A UI replacement for the regions app.

This app depends on data produced by the search-service.

Built with:
- React
- TypeScript
- Bootstrap 5
- Leaflet
- Node version v18.12.1
- Yarn version v1.22.10

## Getting started

### Generate regionsList.json from ./public/regions.json

`./public/regions.json` is used to determine the regions that appear on the `/regions` page. It is a list of objects
with either:

- `label`: label of the contextual layer
- `fid`: layer's field id
  or
- `label`: the name of the aggregation of regions
- `fields`: list of objects with the following properties:
    - `label`: label of the contextual layer
    - `fid`: layer's field id

#### Production

`yarn run build` makes use of `.env.production:VITE_SPATIAL_WS_URL` and `./resources/regions.json` to add a hashed 
`regionsList.json` file into `/dist/assets/`.

Delete the `regionsList*.json` files in the project directory to trigger a rebuild.

#### ALA environment

Refer to [this](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/regions-ui) configuration and deployment information.

#### Local development

Run `buildRegions.js` to produce a `regionsList.json` file.

```bash
node buildRegions.js {spatial-ws-url}
``` 

Update `.env.local` with the URL to this `regionsList.json` file in `.env.local:VITE_REGIONS_CONFIG_URL`. 

Example:
- copy the `regionsList.json` file to the `static-server/static/regions/` directory.
- start the static server, see [static-server](../static-server/README.md).
- use `.env.local:VITE_REGIONS_CONFIG_URL=http://localhost:8082/static/regions/regionsList.json`

### Install dependencies and run the development server

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn install
yarn playwright install --with-deps
yarn test
./run-playwright-test.sh
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
# other services
VITE_APP_BIOCACHE_URL=https://biocache-ws.ala.org.au/ws
VITE_NAMEMATCHING_WS=https://namematching-ws.ala.org.au
VITE_SPECIES_URL_PREFIX=https://bie.ala.org.au/species/
VITE_APP_BIOCACHE_UI_URL=https://biocache.ala.org.au
VITE_SPATIAL_WS_URL=https://spatial.ala.org.au/ws
VITE_SPATIAL_GEOSERVER_URL=https://spatial.ala.org.au/geoserver
# minimal header and footer urls
VITE_CONTACT_URL=https://www.ala.org.au/contact-us/
VITE_CREATE_ACCOUNT_URL=https://userdetails.ala.org.au/registration/createAccount
# common header, footer, css and js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/header.html
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.html
VITE_COMMON_CSS=http://localhost:8082/static/common/common.css
VITE_COMMON_JS=http://localhost:8082/static/common/common.js
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=regions
# regions specific config
VITE_REGIONS_CONFIG_URL=http://localhost:8082/static/regions/regionsList.json
VITE_APP_ALERTS_URL=https://alerts.ala.org.au
VITE_MAP_CENTRE_LAT=-28
VITE_MAP_CENTRE_LNG=133
VITE_MAP_DEFAULT_ZOOM=4
VITE_GLOBAL_FQ=&fq=species%3A*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue
VITE_EARLIEST_YEAR=1850
VITE_PLAYER_INTERVAL_MILLISECONDS=1000
VITE_EXPLORE_URL=https://www.ala.org.au/explore-by-location/
VITE_SPECIES_PAGE_URL=https://bie.ala.org.au/species/
VITE_DOWNLOAD_URL=https://biocache.ala.org.au/download/options1?targetUri=%2Foccurrence%2Fsearch&searchParams=
#VITE_GOOGLE_MAP_API_KEY={optional}
VITE_OPENSTREETMAP_ZXY_URL=https://spatial.ala.org.au/osm/{z}/{x}/{y}.png
```

