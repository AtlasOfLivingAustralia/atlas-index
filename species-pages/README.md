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

# API key for the BHL API
VITE_BHL_API_KEY=

# URLs for various ALA services
VITE_APP_BIOCACHE_UI_URL=https://biocache.ala.org.au
VITE_APP_BHL_URL=https://biodiversitylibrary.org
VITE_APP_IMAGE_BASE_URL=https://images.ala.org.au
VITE_COLLECTIONS_URL=https://collections.ala.org.au
VITE_SPATIAL_URL=https://spatial.ala.org.au

# Base URL for the output of taxon-descriptions "merge" step
VITE_TAXON_DESCRIPTIONS_URL=http://localhost:8082/static/taxon-descriptions

VITE_SDS_INFO_URL=https://support.ala.org.au/support/solutions/articles/6000261705-working-with-threatened-migratory-and-sensitive-species-information-in-the-ala

VITE_BIOCACHE_UI_URL=https://biocache.ala.org.au
```

## Other configuration
### ./config/firstDescriptionLabels.json
This file is used to determine what appears in the header, beneath the common names. It is the list of description tab 
content labels that contain suitably curated content for the first description tab. 
### ./config/onlineResource.{test | prod}.json
This file is used to determine the online resource links that appear at the end of the online resources tab. It is a 
list of objects with the following properties:
- `name`: the text that appears on the button
- `url`: the URL that the button links to
- `external`: true to indicate it opens in a new tab
- `rules`: an array of rules that determine whether the button is visible.

The rules determine what buttons are visible: 
- `inSpeciesGroup`: an array of species groups
- `inSpeciesList`: an array of authoritative list IDs

Rules are applied such that
1. If no rules exist for a resource, it is visible
2. All rules must return TRUE for the resource to be visible
3. A rule returns TRUE if any of the item values exist in the list of rule values.
- e.g. if the rule is inSpeciesGroup: ["Mammals", "Fungi"] and the item.speciesGroup is ["Mammals", "Reptiles"], the rule returns TRUE
- e.g. if the rule is inSpeciesGroup: ["Mammals", "Fungi"] and the item.speciesGroup is ["Reptiles", "Amphibians"], the rule returns FALSE
