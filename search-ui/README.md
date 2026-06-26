# Search and Species Pages

Replacement for the ALA BIE ([`ala-bie-hub`](https://github.com/AtlasOfLivingAustralia/ala-bie-hub)), implemented in React.

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
VITE_APP_API_URL=http://localhost:8081

# static external paths and files for dashboard and vocab view
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

# URLs for various ALA services
VITE_APP_BIOCACHE_UI_URL=https://biocache.ala.org.au
VITE_APP_BHL_URL=https://biodiversitylibrary.org
VITE_APP_IMAGE_BASE_URL=https://images.ala.org.au
VITE_COLLECTIONS_URL=https://collections.ala.org.au
VITE_SPATIAL_URL=https://spatial.ala.org.au

# Base URL for the output of taxon-descriptions "merge" step
VITE_TAXON_DESCRIPTIONS_URL=http://localhost:8082/static/taxon-descriptions

# Base URL for the output of taxon-traits
VITE_TAXON_TRAITS_URL=https://static.test.ala.org.au/taxon-traits

# Base URL to output of taxon-bhl tool
VITE_TAXON_BHL_URL=https://static.test.ala.org.au/taxon-bhl

VITE_SDS_INFO_URL=https://support.ala.org.au/support/solutions/articles/6000261705-working-with-threatened-migratory-and-sensitive-species-information-in-the-ala

VITE_BIOCACHE_UI_URL=https://biocache.ala.org.au

VITE_ALA_NATIVE_INTRODUCED_INFO_URL=https://lists.ala.org.au/speciesListItem/list/dr26948

VITE_APP_ALERTS_URL=https://alerts.ala.org.au
VITE_APP_ALERT_RESOURCE_NAME=Atlas of Living Australia

# Species map config. At least one map type must be enabled.
VITE_LEAFLET_MAP_ENABLED=true
VITE_TAXON_MAP_ENABLED=true
# Required when VITE_TAXON_MAP_ENABLED=true. Base URL for the output of taxon-map tool. 
VITE_TAXON_MAP_URL=http://localhost:8082/static/taxon-map
# Required when VITE_TAXON_MAP_ENABLED=true. Comma separated list of taxon-map types to show, e.g. "aus,region,world".
VITE_TAXON_MAP_ZOOMS=aus,region,world
# Required when VITE_TAXON_MAP_ENABLED=true. Comma separated list of taxon-map base maps to show, e.g. "base".
VITE_TAXON_MAP_BASE_LAYERS=base
```

## Other configuration

### ./src/config/firstDescriptionLabels.json

This file is used to determine what appears in the header, beneath the common names. It is the list of description tab
content labels that contain suitably curated content for the first description tab.

### ./src/config/onlineResource.{test | prod}.json

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

### ./public/speciesGroups.json

This file is consistent with the namematching service file. It must align with search-service. It will produce the
file `./src/config/speciesGroupsMap.json`. The names-extract tool has information on testing this file.

### ./src/config/speciesGroupsMap.json

This file is constructed by the `generateBuildInfo.js` script and using `./public/speciesGroups.json`. This is done
during the dev and build scripts. It is used by the UI to be able to display the species group hierarchy.

### ./src/config/featuredPages.json

This file contains the configuration for the featured pages that appear on the search page, before searching. Each
entry has the following properties:
- `title`: The title that appears on the card.
- `description`: The description that appears on the card.
- `imageUrl`: The image that appears on the card. Must be hosted externally to the application.
- `linkUrl`: The URL that the card opens.
