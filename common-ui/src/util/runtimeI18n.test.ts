/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    getI18nConfig,
    getMessagesUrl,
    getTextDirection,
    loadMessages,
    LOCALE_STORAGE_KEY,
    resolveInitialLocale,
    type I18nRuntimeConfig,
} from './runtimeI18n';

function setSearch(search: string) {
    window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

beforeEach(() => {
    delete (window as any).APP_CONFIG;
    window.localStorage.clear();
    setSearch('');
    jest.restoreAllMocks();
});

describe('getI18nConfig', () => {
    it('defaults to a single bundled-only English locale (baseline unchanged, no runtime fetch)', () => {
        const cfg = getI18nConfig();
        expect(cfg.defaultLocale).toBe('en');
        expect(cfg.locales).toHaveLength(1);
        expect(cfg.locales[0]).toMatchObject({code: 'en'});
        expect(cfg.messagesPath).toBe('');
    });

    it('uses I18N_LOCALES / I18N_DEFAULT_LOCALE when a deployer declares them (runtime opt-in)', () => {
        (window as any).APP_CONFIG = {
            I18N_DEFAULT_LOCALE: 'es',
            I18N_LOCALES: [
                {code: 'en', label: 'English'},
                {code: 'es', label: 'Español'},
            ],
        };
        const cfg = getI18nConfig();
        expect(cfg.defaultLocale).toBe('es');
        expect(cfg.locales).toHaveLength(2);
        expect(cfg.messagesPath).toBe('/i18n/{locale}.json');
    });

    it('ignores an empty I18N_LOCALES array and falls back to the default', () => {
        (window as any).APP_CONFIG = {I18N_LOCALES: []};
        expect(getI18nConfig().locales).toHaveLength(1);
    });
});

describe('resolveInitialLocale', () => {
    const config: I18nRuntimeConfig = {
        defaultLocale: 'en',
        locales: [
            {code: 'en', label: 'English'},
            {code: 'es', label: 'Español'},
        ],
        messagesPath: '',
    };

    it('prefers ?lang over storage and default', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
        setSearch('lang=es');
        expect(resolveInitialLocale(config)).toBe('es');
    });

    it('falls back to localStorage when no query param', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
        expect(resolveInitialLocale(config)).toBe('es');
    });

    it('falls back to defaultLocale when neither query nor storage is set', () => {
        expect(resolveInitialLocale(config)).toBe('en');
    });

    it('ignores an unknown requested code and uses the default', () => {
        setSearch('lang=zz');
        expect(resolveInitialLocale(config)).toBe('en');
    });
});

describe('loadMessages', () => {
    const bundled = {'a': 'A', 'b': 'B'};
    const config: I18nRuntimeConfig = {
        defaultLocale: 'en',
        locales: [
            {code: 'en', label: 'English'},
            {code: 'es', label: 'Español'},
            {code: 'de', label: 'Deutsch'},
        ],
        messagesPath: '/i18n/{locale}-test.json',
    };

    it('returns the bundled fallback without fetching when no messagesPath is set', async () => {
        const fetchMock = jest.fn();
        (global as any).fetch = fetchMock;
        const out = await loadMessages('en', {...config, messagesPath: ''}, bundled);
        expect(out).toBe(bundled);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('overlays the external catalogue on top of the bundled base (external wins, bundled fills gaps)', async () => {
        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({'b': 'Bexternal', 'c': 'C'}),
        });
        const out = await loadMessages('es', config, bundled);
        expect(out).toEqual({a: 'A', b: 'Bexternal', c: 'C'});
    });

    it('falls back to the bundled base when the fetch fails', async () => {
        (global as any).fetch = jest.fn().mockResolvedValue({ok: false, status: 500});
        const out = await loadMessages('de', config, bundled);
        expect(out).toEqual(bundled);
    });

    it('gives up on a host that never answers, so the page is not blocked forever', async () => {
        // Stand in for the abort: the page must end up rendering with the bundled messages rather
        // than waiting on the request.
        (global as any).fetch = jest.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
        const out = await loadMessages('de', {...config, messagesPath: '/i18n/{locale}-hang.json'}, bundled);
        expect(out).toEqual(bundled);
    });
});

describe('getMessagesUrl', () => {
    const withPath = (messagesPath: string): I18nRuntimeConfig => ({
        defaultLocale: 'en',
        locales: [{code: 'es', label: 'Español'}],
        messagesPath,
    });

    it('substitutes {locale} in the configured path', () => {
        expect(getMessagesUrl('es', withPath('/i18n/{locale}.json'))).toBe('/i18n/es.json');
    });

    it('supports a different file naming and an absolute URL', () => {
        expect(getMessagesUrl('es', withPath('/i18n/messages_{locale}.json'))).toBe('/i18n/messages_es.json');
        expect(getMessagesUrl('es', withPath('https://host/x/{locale}.json'))).toBe('https://host/x/es.json');
    });

    it('returns nothing when no path is configured, so no request is made', () => {
        expect(getMessagesUrl('es', withPath(''))).toBe('');
    });
});

describe('getTextDirection', () => {
    it('reports ltr for left-to-right languages', () => {
        for (const code of ['en', 'es', 'fr', 'pt-BR', 'zh-Hans']) {
            expect(getTextDirection(code)).toBe('ltr');
        }
    });

    it('reports rtl for right-to-left languages, including regional variants', () => {
        for (const code of ['ar', 'he', 'fa', 'ur', 'ar-EG', 'AR']) {
            expect(getTextDirection(code)).toBe('rtl');
        }
    });
});
