/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime i18n configuration.
 *
 * Vite resolves static imports at build time, so a built SPA cannot be translated again without
 * rebuilding it. Instead the messages are loaded at runtime from an external location, set in
 * `window.APP_CONFIG` by `config.js`, the same way the Grails applications do it with ala-i18n
 * (see biocache-hubs#323). The catalogues can come from Crowdin and be released on their own
 * schedule. Each app also passes its bundled `translations/en.json`, which is used for anything
 * the external catalogue does not have.
 */

import {getRuntimeConfig} from './runtimeConfig.ts';

export interface I18nLocale {
    code: string; // e.g. "en", "es"
    label: string; // e.g. "English", "Español"
}

export interface I18nRuntimeConfig {
    defaultLocale: string;
    locales: I18nLocale[];
    // Where the catalogues live, as a path with a {locale} placeholder. Empty => bundled messages
    // only, with no network request.
    messagesPath: string;
}

/**
 * Default location of the catalogues once a deployer declares locales. It is a same-origin path on
 * purpose: the usual deployment is to serve the directory the ala-i18n package installs (e.g. an
 * alias or symlink to /opt/atlas/i18n/<app>/), so nothing external is involved. An absolute URL
 * works too when the catalogues are hosted elsewhere.
 */
export const DEFAULT_MESSAGES_PATH = '/i18n/{locale}.json';

const LOCALE_PLACEHOLDER = /\{locale}/g;

// The i18n slice of `window.APP_CONFIG`, contributed to the shared RuntimeConfig from here so that
// runtimeConfig.ts stays unaware of i18n. Any other area adds its own keys the same way.
declare module './runtimeConfig.ts' {
    interface RuntimeConfig {
        I18N_DEFAULT_LOCALE?: string;
        I18N_LOCALES?: I18nLocale[];
        /**
         * Overrides DEFAULT_MESSAGES_PATH, e.g. '/i18n/messages_{locale}.json' to match a different
         * file naming, or a full URL to load the catalogues from another host.
         */
        I18N_MESSAGES_PATH?: string;
    }
}

export const LOCALE_STORAGE_KEY = 'ala.locale';
export const LOCALE_QUERY_PARAM = 'lang';

// Languages written right-to-left, by ISO 639-1 primary subtag (so "ar-EG" resolves like "ar").
const RTL_LANGUAGES = new Set(['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);

/**
 * Text direction for a locale code. Right-to-left and non-Latin scripts are an open item for the
 * community (see the ALA i18n status document), and `dir`/`lang` on the root element are the
 * prerequisite for it: they drive the browser's bidi algorithm, `:dir()` styling, screen reader
 * pronunciation and per-language font fallback. Full RTL styling still needs logical CSS properties.
 */
export function getTextDirection(code: string): 'ltr' | 'rtl' {
    return RTL_LANGUAGES.has(code.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr';
}

/**
 * Baseline (config.js absent or declaring no locales): a SINGLE English locale served from the
 * BUNDLED translations, with no runtime fetch, and the language switcher stays hidden because
 * locales.length <= 1. messagesPath is empty here so loadMessages() returns the bundle without any
 * network call. Declaring I18N_LOCALES is what opts a deployment into the runtime path.
 */
const DEFAULT_CONFIG: I18nRuntimeConfig = {
    defaultLocale: 'en',
    locales: [{code: 'en', label: 'English'}],
    messagesPath: '',
};

export function getI18nConfig(): I18nRuntimeConfig {
    const cfg = getRuntimeConfig();
    const declared = cfg.I18N_LOCALES && cfg.I18N_LOCALES.length > 0 ? cfg.I18N_LOCALES : null;
    const defaultLocale = cfg.I18N_DEFAULT_LOCALE || DEFAULT_CONFIG.defaultLocale;
    if (!declared) {
        return {...DEFAULT_CONFIG, defaultLocale};
    }
    // Declaring locales is what opts a deployment into loading catalogues; the path only says where
    // they are, so it falls back to the conventional location rather than disabling the feature.
    return {defaultLocale, locales: declared, messagesPath: cfg.I18N_MESSAGES_PATH || DEFAULT_MESSAGES_PATH};
}

/** Resolve the catalogue location for a locale, or '' when messages come from the bundle only. */
export function getMessagesUrl(code: string, config: I18nRuntimeConfig): string {
    if (!config.messagesPath) return '';
    return config.messagesPath.replace(LOCALE_PLACEHOLDER, encodeURIComponent(code));
}

/**
 * Resolve the initial locale: ?lang=xx -> localStorage -> defaultLocale -> 'en', validated against
 * the available locales (falls back to defaultLocale if the requested code is unknown).
 */
export function resolveInitialLocale(config: I18nRuntimeConfig): string {
    const known = new Set(config.locales.map((l) => l.code));
    const fromQuery = new URLSearchParams(window.location.search).get(LOCALE_QUERY_PARAM);
    const fromStorage = (() => {
        try {
            return window.localStorage.getItem(LOCALE_STORAGE_KEY);
        } catch {
            return null;
        }
    })();
    for (const candidate of [fromQuery, fromStorage, config.defaultLocale, 'en']) {
        if (candidate && known.has(candidate)) return candidate;
    }
    return config.locales[0]?.code ?? 'en';
}

const MESSAGES_CACHE: Map<string, Record<string, string>> = new Map();

/**
 * Nothing is rendered until the messages are ready, so a server that never answers would leave the
 * page blank. Give up after this long and use the bundled messages instead.
 */
export const MESSAGES_FETCH_TIMEOUT_MS = 5000;

async function fetchMessages(url: string): Promise<Record<string, string>> {
    if (MESSAGES_CACHE.has(url)) return MESSAGES_CACHE.get(url)!;
    try {
        // AbortSignal.timeout is unavailable in older browsers and some test environments; without it
        // the request simply keeps its previous unbounded behaviour.
        const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(MESSAGES_FETCH_TIMEOUT_MS)
            : undefined;
        const resp = await fetch(url, signal ? {signal} : undefined);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as Record<string, string>;
        MESSAGES_CACHE.set(url, data);
        return data;
    } catch (e) {
        console.warn(`[i18n] Failed to load messages from ${url}, using bundled fallback`, e);
        return {};
    }
}

/**
 * Load messages for a locale. The bundled messages are the base/fallback; the external resource
 * (if any) is overlaid on top (external wins, bundled fills gaps) — applying the "external first,
 * bundled last" order to every locale, including English.
 */
export async function loadMessages(
    code: string,
    config: I18nRuntimeConfig,
    bundledFallback: Record<string, string>
): Promise<Record<string, string>> {
    const known = config.locales.some((l) => l.code === code);
    const url = known ? getMessagesUrl(code, config) : '';
    if (!url) return bundledFallback;
    const fetched = await fetchMessages(url);
    return {...bundledFallback, ...fetched};
}
