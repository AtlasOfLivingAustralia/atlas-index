/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime configuration accessor.
 *
 * Vite bakes `import.meta.env.VITE_*` at BUILD time, so a prebuilt SPA artifact cannot be
 * re-pointed at a different portal without rebuilding. To restore the legacy "isolated
 * branding" operative — where a portal consumes a shared, prebuilt app and supplies only its
 * own config — we read selected keys at RUNTIME from `window.APP_CONFIG`, which is set by an
 * un-hashed `public/config.js` (emitted at the site root and overwritable per deployment with
 * no rebuild). Falls back to the build-time value when the key is absent.
 *
 * Currently used only for the theme pointer (VITE_THEME_CONFIG_URL); designed to extend to the
 * full per-portal config set later (see SPEC.md, Layer 2).
 */
declare global {
    interface Window {
        APP_CONFIG?: Record<string, string>;
    }
}

export function getRuntimeConfig(key: string, fallback: string): string {
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG[key] != null) {
        return window.APP_CONFIG[key];
    }
    return fallback;
}
