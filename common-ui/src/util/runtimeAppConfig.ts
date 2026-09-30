/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime application configuration.
 *
 * The service endpoints each UI talks to (search-service, biocache, collectory, spatial, alerts,
 * images, events...) come from `import.meta.env.VITE_APP_*`, resolved at build time, so pointing a
 * deployment at a different set of backends means rebuilding. This lets `config.js`/`config.local.js`
 * override them, the same way `runtimeTheme.ts` overrides the theme URLs — see runtimeConfig.ts.
 *
 * OIDC client settings (VITE_OIDC_*) are declared in the `.env` files but are not read by these UIs:
 * the browser never talks to the identity provider directly, it only calls `search-service`'s
 * `/login`/`/logout`/`/session` (see util/auth.tsx), and `search-service` itself already reads its
 * OIDC config from an external, deployment-mounted file (`security.oidc.*` in
 * `search-service-config.properties`, per `spring.config.import`). So there is nothing to add here for
 * OIDC — the axis is already closed on the backend.
 */

import {getRuntimeConfig} from './runtimeConfig.ts';

declare module './runtimeConfig.ts' {
    interface RuntimeConfig {
        VITE_APP_ALERT_RESOURCE_NAME?: string;
        VITE_APP_ALERTS_URL?: string;
        VITE_APP_ALERTS_WS_URL?: string;
        VITE_APP_API_URL?: string;
        VITE_APP_AUSTRAITS_LOGO?: string;
        VITE_APP_BASE_URL?: string;
        VITE_APP_BHL_URL?: string;
        VITE_APP_BIOCACHE_UI_URL?: string;
        VITE_APP_BIOCACHE_URL?: string;
        VITE_APP_BIOCOLLECT_URL?: string;
        VITE_APP_COLLECTORY_URL?: string;
        VITE_APP_DATA_QUALITY_INVERSE_URL?: string;
        VITE_APP_DATA_QUALITY_URL?: string;
        VITE_APP_DIGIVOL_URL?: string;
        VITE_APP_DQ_DEFAULT_PROFILE?: string;
        VITE_APP_DQ_INFO_URL?: string;
        VITE_APP_DQ_WIKI_URL?: string;
        VITE_APP_EVENTS_ENABLED?: string;
        VITE_APP_EVENTS_GRAPHQL_URL?: string;
        VITE_APP_EVENTS_HIERARCHY_URL?: string;
        VITE_APP_FIELDGUIDE_DOWNLOAD_URL?: string;
        VITE_APP_ICONIC_SPECIES_LIST?: string;
        VITE_APP_IMAGE_BASE_URL?: string;
        VITE_APP_IMAGE_METADATA_URL?: string;
        VITE_APP_IMAGE_SERVICE_URL?: string;
        VITE_APP_IMAGE_THUMBNAIL_URL?: string;
        VITE_APP_IMAGE_VIEWER_URL?: string;
        VITE_APP_KNOWLEDGE_BASE_URL?: string;
        VITE_APP_MY_ALERTS_URL?: string;
        VITE_APP_MY_DOWNLOADS_URL?: string;
        VITE_APP_NAME?: string;
        VITE_APP_ROLE_ADMIN?: string;
        VITE_APP_SPATIAL_SERVICE_URL?: string;
        VITE_APP_SPATIAL_URL?: string;
    }
}

export type AppConfigKey =
    | 'VITE_APP_ALERT_RESOURCE_NAME'
    | 'VITE_APP_ALERTS_URL'
    | 'VITE_APP_ALERTS_WS_URL'
    | 'VITE_APP_API_URL'
    | 'VITE_APP_AUSTRAITS_LOGO'
    | 'VITE_APP_BASE_URL'
    | 'VITE_APP_BHL_URL'
    | 'VITE_APP_BIOCACHE_UI_URL'
    | 'VITE_APP_BIOCACHE_URL'
    | 'VITE_APP_BIOCOLLECT_URL'
    | 'VITE_APP_COLLECTORY_URL'
    | 'VITE_APP_DATA_QUALITY_INVERSE_URL'
    | 'VITE_APP_DATA_QUALITY_URL'
    | 'VITE_APP_DIGIVOL_URL'
    | 'VITE_APP_DQ_DEFAULT_PROFILE'
    | 'VITE_APP_DQ_INFO_URL'
    | 'VITE_APP_DQ_WIKI_URL'
    | 'VITE_APP_EVENTS_ENABLED'
    | 'VITE_APP_EVENTS_GRAPHQL_URL'
    | 'VITE_APP_EVENTS_HIERARCHY_URL'
    | 'VITE_APP_FIELDGUIDE_DOWNLOAD_URL'
    | 'VITE_APP_ICONIC_SPECIES_LIST'
    | 'VITE_APP_IMAGE_BASE_URL'
    | 'VITE_APP_IMAGE_METADATA_URL'
    | 'VITE_APP_IMAGE_SERVICE_URL'
    | 'VITE_APP_IMAGE_THUMBNAIL_URL'
    | 'VITE_APP_IMAGE_VIEWER_URL'
    | 'VITE_APP_KNOWLEDGE_BASE_URL'
    | 'VITE_APP_MY_ALERTS_URL'
    | 'VITE_APP_MY_DOWNLOADS_URL'
    | 'VITE_APP_NAME'
    | 'VITE_APP_ROLE_ADMIN'
    | 'VITE_APP_SPATIAL_SERVICE_URL'
    | 'VITE_APP_SPATIAL_URL';

/**
 * A service URL/value from runtime config, or the build's own default (typically
 * `import.meta.env.VITE_APP_*`) when the deployment hasn't overridden it. Mirrors getThemeValue.
 */
export function getAppConfigValue(key: AppConfigKey, fallback: string): string {
    const value = getRuntimeConfig()[key];
    return value && value.trim() ? value : fallback;
}
