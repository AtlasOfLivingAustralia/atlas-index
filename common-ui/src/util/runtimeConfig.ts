/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Settings a deployment can change after the build. They are read from two globals, set by two
 * scripts loaded before the app bundle:
 *
 *   config.js        ships with the build and is replaced on every deploy. It holds the defaults
 *                    the application maintains, and documents every key.
 *   config.local.js  belongs to the deployment, is never shipped and is never overwritten. Its
 *                    values win over the defaults.
 *
 * The point of the split is that a new release can update the defaults without discarding what the
 * deployment set, and that the deployment's file only carries the differences rather than a stale
 * copy of everything. `config.local.js` is optional; a 404 for it is harmless.
 *
 * This is not only for translations: anything that is different in each portal and does not need a
 * rebuild can go here, so we do not end up with one mechanism per feature. Each part of the code
 * adds its own keys by augmenting `RuntimeConfig` from its own module, and reads them with
 * `getRuntimeConfig()`.
 *
 * Whether a build loads these files at all depends on the build profile; see
 * viteRuntimeConfigPlugin.
 */

export interface RuntimeConfig {
    /**
     * Portal display name (e.g. "Atlas of Living Australia", "NBN Atlas"). Kept OUT of the
     * translatable strings so the same messages ("Search {portalName}") work for any portal.
     */
    PORTAL_NAME?: string;
}

declare global {
    interface Window {
        /** Defaults, from the config.js that ships with the build. */
        APP_CONFIG?: RuntimeConfig;
        /** Overrides, from the deployment's own config.local.js. */
        APP_CONFIG_LOCAL?: RuntimeConfig;
    }
}

/**
 * The defaults with the local overrides on top, or an empty object when neither file is there.
 * The merge is one level deep, so a key set locally replaces the default outright, which is what
 * you want for a list such as I18N_LOCALES.
 */
export function getRuntimeConfig(): RuntimeConfig {
    if (typeof window === 'undefined') return {};
    return {...window.APP_CONFIG, ...window.APP_CONFIG_LOCAL};
}

/**
 * Portal display name from runtime config, so a prebuilt artifact can be rebranded per portal
 * without rebuilding and WITHOUT baking the name into translations. Use it as a FormattedMessage
 * value: `defaultMessage="Search {portalName}"`, `values={{portalName: getPortalName(...)}}`.
 */
export function getPortalName(fallback: string): string {
    const value = getRuntimeConfig().PORTAL_NAME;
    return value && value.trim() ? value : fallback;
}
