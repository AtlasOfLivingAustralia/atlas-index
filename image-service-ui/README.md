# Image Service UI

A React/TypeScript/Vite frontend for the ALA image-service (`AtlasOfLivingAustralia/image-service`),
replacing its legacy Grails/GSP UI. It follows the same conventions as the other apps in this
monorepo (see `doi-ui` for the authentication pattern and `admin-ui` for the admin shell pattern).

## What this app covers

- **Public search** (`/`) — keyword search, sorting, pagination, facets, active filter pills,
  an advanced-search panel backed by admin-configured field definitions, and an authenticated
  ZIP download of the current result set.
- **Image / media detail** (`/image/:imageId`) — a zoomable Leaflet tile viewer for images (falls
  back to an `<audio>` player or a document download link for other media types), original
  download, JSON metadata link, core/system/embedded/user/data-resource metadata tabs, tags,
  parent/sub-image navigation, and (when authenticated) tag attach/detach, metadata editing,
  calibration, sub-image creation, and owner/admin deletion.
- **Admin** (`/admin/*`, gated on `ROLE_ADMIN` or `ROLE_IMAGE_ADMIN`) — dashboard (repository
  stats + background queue depths), upload (single image / CSV / URL batch / local ingest),
  batch status, advanced-search criteria CRUD, a raw Elasticsearch query console, tag tree
  management (create/rename/move/delete/import), storage locations (create/set default/migrate),
  licences + source-value mappings, duplicate group review, usage analytics, repository
  settings, maintenance tools (reindex/clear queues/clear failed uploads), and an API
  documentation view (Swagger).
- **Legacy route compatibility** — `/search?q=...` redirects to `/?q=...`, `/image/view/:imageId`
  and `/admin/image/:imageId` redirect to `/image/:imageId` (which is otherwise unchanged from the
  legacy `image_url` route).

See the "unresolved backend dependencies" section of the implementation report (delivered
alongside this change) for what is fully implemented vs. scaffolded against the assumed backend
contract.

## Backend contract

This app uses the image-service's existing `/ws/**`, `/image/**`, `/search/**`, `/admin/**`,
`/storageLocation/**` and `/batch/**` routes. It does not require a new
image-service endpoint. Request shapes are centralized in `src/api/endpoints.ts`.

Image data requests use `credentials: 'include'`. Login uses exactly the same implementation as
`doi-ui`: the shared common-ui helpers call the atlas-index `search-service` `/session`, `/login`,
and `/logout` endpoints. `search-service` performs the Cognito Authorization Code flow with PKCE,
handles `/callback`, and returns the authenticated user's roles through `/session`.

## Deployment with the unchanged test image service

The production configuration targets `https://images.test.ala.org.au` for image data and
`https://service.test.ala.org.au` for authentication, matching `doi-ui`. A dedicated deployment may
override `VITE_APP_API_URL` with another `search-service` origin.

Keep these routes on the existing image-service backend:

- `/ws/**`, `/store/**`, `/iiif/**`
- image assets and legacy fragments under `/image/**`
- `/search/download` and `/search/list`
- backend actions under `/admin/**`, `/storageLocation/**`, and `/batch/**`

Route `/session`, `/login`, `/logout`, and `/callback` to the image UI's `search-service` when it is
exposed on the same origin. Do not route those paths to the legacy image-service.

Serve the built `dist` assets and React history fallback for the UI routes (`/`, `/image/:id`, and
the UI admin pages). Where a UI route shares a prefix with backend routes, give the explicit
backend patterns above higher routing priority. Local development uses Vite's `/image-service`
proxy, whose target is read from `VITE_APP_IMAGES_API_URL`, so the legacy backend does not need local CORS
changes either.

## Getting started

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn run build
```

## Tests

```bash
yarn test              # Jest unit tests (src/**/*.test.tsx)
yarn test:playwright   # Playwright synthetic/acceptance tests (tests/**)
```

## Environment variables

```properties
VITE_HOME_URL=https://ala.org.au
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png

VITE_ENV=local
VITE_APP_BASE_URL=http://localhost:5173
VITE_APP_IMAGES_API_URL=https://images.test.ala.org.au
VITE_APP_API_URL=https://service.test.ala.org.au

# Either role grants access to /admin/*; the backend remains authoritative.
VITE_APP_ROLE_ADMIN=ROLE_ADMIN
VITE_APP_ROLE_IMAGE_ADMIN=ROLE_IMAGE_ADMIN

# Fallback thumbnail/original URL builders, used only if an /api/v2 response
# does not already embed an absolute thumbnailUrl/originalUrl.
VITE_APP_IMAGE_THUMBNAIL_URL=https://images.ala.org.au/image/proxyImageThumbnail?imageId=
VITE_APP_IMAGE_LINK_URL=https://images.ala.org.au/image/

# Common header, footer, css and js
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/banner.mustache
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.mustache
VITE_COMMON_CSS=http://localhost:8082/static/common/ala-combined.css
VITE_COMMON_JS=http://localhost:8082/static/common/ala-combined.js
VITE_COMMON_CONTAINER_CLASS=container-fluid
VITE_SEARCH_URL_PREFIX=https://bie.test.ala.org.au
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=images

# Swagger sources for the admin API documentation view
# Format: "name|url;name|url;..."
VITE_SWAGGER_SOURCES=image-service|https://images.ala.org.au/ws/api
```
