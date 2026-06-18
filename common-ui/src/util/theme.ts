/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime theme configuration.
 *
 * A theme is a static `theme.json` manifest (hostable on e.g. GitHub Pages) that points to
 * all the brandable assets of an atlas-index UI: CSS, header/footer Mustache templates,
 * logo and (for future use) the available locales. UIs fetch it at startup via the
 * `VITE_THEME_CONFIG_URL` env var, so an organisation can re-skin the apps without a rebuild.
 *
 * Locale switching is declared here for forward-compatibility but is NOT yet consumed by the
 * minimal {@link useTheme} hook (see SPEC.md "Deferred" section).
 */
export interface ThemeLocale {
    code: string; // e.g. "en", "es", "fr"
    label: string; // e.g. "English", "Español"
    messagesUrl: string; // URL to a Crowdin-compatible flat JSON: { "key": "translated string" }
}

export interface ThemeConfig {
    cssUrls: string[]; // injected as <link> in order (delegated to injectCommonInfo)
    jsUrls: string[]; // loaded sequentially after header HTML
    headerUrl: string; // URL to banner.mustache
    footerUrl: string; // URL to footer.mustache
    logoUrl: string; // substituted for {{logoUrl}} in mustache
    homeUrl: string; // substituted for {{homeUrl}} in mustache
    defaultLocale: string; // e.g. "en"
    locales: ThemeLocale[]; // list of available locales; reserved for the locale switcher
}

const THEME_CONFIG_CACHE: Map<string, ThemeConfig> = new Map();

/**
 * Fetch and cache a theme.json manifest. Falls back to `fallback` if `url` is empty or the
 * fetch fails, so a missing/broken theme degrades to the built-in (env-var) defaults rather
 * than breaking the app.
 */
export async function fetchThemeConfig(url: string, fallback: ThemeConfig): Promise<ThemeConfig> {
    if (!url) {
        return fallback;
    }
    if (THEME_CONFIG_CACHE.has(url)) {
        return THEME_CONFIG_CACHE.get(url)!;
    }
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: ThemeConfig = await resp.json();
        THEME_CONFIG_CACHE.set(url, data);
        return data;
    } catch (e) {
        console.warn(`[theme] Failed to load theme from ${url}, using fallback`, e);
        return fallback;
    }
}

/**
 * Fetch locale messages (Crowdin-compatible flat JSON). Reserved for future runtime locale
 * switching; not yet wired into {@link useTheme}.
 */
export async function fetchLocaleMessages(url: string): Promise<Record<string, string>> {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.warn(`[theme] Failed to load locale messages from ${url}`, e);
        return {};
    }
}
