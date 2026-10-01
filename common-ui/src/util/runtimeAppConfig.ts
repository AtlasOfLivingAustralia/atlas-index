/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime application configuration.
 *
 * The service endpoints each UI talks to (search-service, biocache, collectory, spatial, alerts,
 * images, events...) come from `import.meta.env.VITE_APP_*`, resolved at build time. In the LA
 * Community build, viteRuntimeConfigPlugin rewrites every `import.meta.env.VITE_APP_X` in the
 * app's sources to `getAppConfigValue('VITE_APP_X', import.meta.env.VITE_APP_X)`, so any
 * `VITE_APP_*` key can be overridden from `config.js`/`config.local.js` without a rebuild. There
 * is no list of keys to maintain and no call to add in the code: a new `VITE_APP_*` variable is
 * overridable from the day it is used. The ALA build is not rewritten, so it is unchanged.
 *
 * OIDC client settings (VITE_OIDC_*) are declared in the `.env` files but are not read by these UIs:
 * the browser never talks to the identity provider directly, it only calls `search-service`'s
 * `/login`/`/logout`/`/session` (see util/auth.tsx), and `search-service` itself already reads its
 * OIDC config from an external, deployment-mounted file. So there is nothing to add here for OIDC.
 */

import {getRuntimeConfig} from './runtimeConfig.ts';

/**
 * The value `config.js`/`config.local.js` declares for `key`, or `fallback` (the build's own
 * `import.meta.env.VITE_APP_*`) when the deployment hasn't set it or left it blank.
 */
export function getAppConfigValue(key: string, fallback: string): string {
    const value = (getRuntimeConfig() as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}
