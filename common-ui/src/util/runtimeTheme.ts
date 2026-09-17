/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime theme configuration.
 *
 * The header, footer, and their CSS/JS are already external: `Header`/`Footer` fetch mustache
 * templates from a URL, and `injectCommonInfo`/`injectCommonJs` load CSS/JS from a URL. Today those
 * URLs come from `import.meta.env.VITE_COMMON_*`, resolved at build time, so pointing a deployment
 * at a different theme means rebuilding. This lets `config.js`/`config.local.js` override them, the
 * same way `runtimeI18n.ts` overrides the message catalogue location — see runtimeConfig.ts.
 */

import {getRuntimeConfig} from './runtimeConfig.ts';

declare module './runtimeConfig.ts' {
    interface RuntimeConfig {
        THEME_HEADER_URL?: string;
        THEME_FOOTER_URL?: string;
        THEME_CSS_URL?: string;
        THEME_JS_URL?: string;
        THEME_CONTAINER_CLASS?: string;
    }
}

export type ThemeConfigKey =
    | 'THEME_HEADER_URL'
    | 'THEME_FOOTER_URL'
    | 'THEME_CSS_URL'
    | 'THEME_JS_URL'
    | 'THEME_CONTAINER_CLASS';

/**
 * A theme URL/value from runtime config, or the build's own default (typically
 * `import.meta.env.VITE_COMMON_*`) when the deployment hasn't overridden it. Mirrors getPortalName.
 */
export function getThemeValue(key: ThemeConfigKey, fallback: string): string {
    const value = getRuntimeConfig()[key];
    return value && value.trim() ? value : fallback;
}
