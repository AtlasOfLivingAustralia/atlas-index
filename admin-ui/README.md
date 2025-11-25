# Default UI

UI for admin functions:
- search-service
  - Managed tasks, scheduling and related logs.
  - Manage index taxon records.
  - Manage data quality profiles.

## Getting started

```bash
yarn install
yarn run dev
```

## Production build

```bash
yarn run build
```

## Environment variables

The following environment variables are used:

TODO: clean up this list. Add comments to explain each line. It is already a mess.

```properties
VITE_HOME_URL=https://ala.org.au
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png
VITE_APP_BIE_URL=http://localhost:8081

# used by login/logout redirection
VITE_APP_BASE_URL=http://localhost:5173
VITE_APP_API_URL=http://localhost:8081

# static external paths and files for dashboard and vocab view
VITE_APP_STATIC_URL=http://localhost:8082/static
VITE_APP_DASHBOARD_DATA_URL=http://localhost:8082/static/dashboard/dashboard.json
VITE_APP_DASHBOARD_ZIP_URL=http://localhost:8082/static/dashboard/dashboard.zip
VITE_APP_DASHBOARD_I18N_URL=http://localhost:8082/static/dashboard/dashboardI18n.json
VITE_APP_VOCAB_BASE_URL=http://localhost:8082/static/vocab/

# for use by the api view
VITE_APP_BIOCACHE_URL=https://biocache-ws.ala.org.au/ws
VITE_BIOCACHE_OPENAPI=https://biocache-ws.ala.org.au/ws/v3/api-docs

# for use by atlas-admin view
VITE_APP_IMAGE_THUMBNAIL_URL=https://images.ala.org.au/image/proxyImageThumbnail?imageId=
VITE_APP_IMAGE_LINK_URL=https://images.ala.org.au/image/

# URL has the listID appended and is used to open a tab to a species list, used by atlas-admin view
VITE_APP_LIST_URL=https://lists.ala.org.au/speciesListItem/list/

# Admin role is 'ROLE_ADMIN' (OIDC) or 'admin' (Cognito)
VITE_ADMIN_ROLE=ROLE_ADMIN

```

