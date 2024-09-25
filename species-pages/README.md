# Species Pages SPA

Replacement for the ALA BIE ([`ala-bie-hub`](https://github.com/AtlasOfLivingAustralia/ala-bie-hub)), implemented in React using the [Mantine UI](https://mantine.dev/) library.

Uses:
- React
- TypeScript (for the most part)
- Mantine
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

## Environment variables

The following environment variables are used:

TODO: clean up this list. Add comments to explain each line. It is already a mess.
```properties
VITE_HOME_URL=https://ala.org.au
VITE_OIDC_AUTH_PROFILE=
VITE_SIGNUP_URL=
VITE_OIDC_REDIRECT_URL=http://localhost:5173
VITE_OIDC_AUTH_SERVER=
VITE_OIDC_CLIENT_ID=
VITE_OIDC_SCOPE=openid profile email ala/attrs ala/roles
VITE_LOGO_URL=https://www.ala.org.au/app/uploads/2019/01/logo.png
VITE_APP_BIE_URL=http://localhost:8081

# static external paths and files for dashboard and vocab view
VITE_APP_STATIC_URL=http://localhost:8082/static
VITE_APP_DASHBOARD_DATA_URL=http://localhost:8082/static/dashboard/dashboard.json
VITE_APP_DASHBOARD_ZIP_URL=http://localhost:8082/static/dashboard/dashboard.zip
VITE_APP_DASHBOARD_I18N_URL=http://localhost:8082/static/dashboard/dashboardI18n.json
VITE_APP_VOCAB_BASE_URL=http://localhost:8082/static/vocab/

# for use by the api view
VITE_APP_BIOCACHE_URL=https://biocache-ws.ala.org.au/ws
VITE_ATLAS_OPENAPI=http://localhost:8081/api-docs
VITE_BIOCACHE_OPENAPI=https://biocache-ws.ala.org.au/ws/v3/api-docs

# for use by atlas-admin view
VITE_APP_IMAGE_THUMBNAIL_URL=https://images.ala.org.au/image/proxyImageThumbnail?imageId=
VITE_APP_IMAGE_LINK_URL=https://images.ala.org.au/image/

# URL has the listID appended and is used to open a tab to a species list, used by atlas-admin view
VITE_APP_LIST_URL=https://lists.ala.org.au/speciesListItem/list/

# User roles are found in property 'role' (OIDC) or 'cognito:groups' (Cognito)
VITE_PROFILE_ROLES=cognito:groups

# User id is found in profile property 'userid' (OIDC) or 'cognito:username' (Cognito)
VITE_PROFILE_USERID=cognito:username

# Admin role is 'ROLE_ADMIN' (OIDC) or 'admin' (Cognito)
VITE_ADMIN_ROLE=admin

```

