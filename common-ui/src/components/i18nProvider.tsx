/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {IntlConfig, IntlProvider} from 'react-intl';
import {
    getI18nConfig,
    getTextDirection,
    I18nLocale,
    loadMessages,
    LOCALE_QUERY_PARAM,
    LOCALE_STORAGE_KEY,
    resolveInitialLocale,
} from '../util/runtimeI18n';

type OnErrorFn = IntlConfig['onError'];

interface I18nContextValue {
    locale: string;
    locales: I18nLocale[];
    setLocale: (code: string) => void;
}

const I18nContext = createContext<I18nContextValue>({
    locale: 'en',
    locales: [],
    setLocale: () => {},
});

export function useRuntimeLocale(): I18nContextValue {
    return useContext(I18nContext);
}

// Default: ignore missing-translation noise (the bundled fallback covers it), log everything else.
const defaultOnError: OnErrorFn = (err) => {
    if (err.code === 'MISSING_TRANSLATION') return;
    console.error(err);
};

interface I18nProviderProps {
    /** The app's bundled translations, used as the offline fallback / gap-filler base. */
    messages: Record<string, string>;
    onError?: OnErrorFn;
    children: React.ReactNode;
}

/**
 * Loads translation messages at runtime from the external resource declared in window.APP_CONFIG
 * (see runtimeI18n.ts) and provides them to react-intl, overlaid on the bundled `messages`.
 * Renders nothing until the initial messages are ready, so the app never flashes untranslated keys.
 */
const I18nProvider: React.FC<I18nProviderProps> = ({messages: bundled, onError = defaultOnError, children}) => {
    const config = useMemo(() => getI18nConfig(), []);
    const [locale, setLocaleState] = useState<string>(() => resolveInitialLocale(config));
    const [messages, setMessages] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadMessages(locale, config, bundled).then((m) => {
            if (!cancelled) setMessages(m);
        });
        return () => {
            cancelled = true;
        };
    }, [locale, config, bundled]);

    // Keep the document's language and text direction in step with the active locale: assistive
    // technology, the browser's bidi handling and `:lang()`/`:dir()` styling all read these.
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = getTextDirection(locale);
    }, [locale]);

    function setLocale(code: string) {
        try {
            window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
        } catch {
            /* ignore storage failures (private mode, etc.) */
        }
        const url = new URL(window.location.href);
        url.searchParams.set(LOCALE_QUERY_PARAM, code);
        window.history.replaceState({}, '', url);
        setLocaleState(code);
    }

    const ctx = useMemo<I18nContextValue>(
        () => ({locale, locales: config.locales, setLocale}),
        [locale, config.locales]
    );

    if (messages === null) {
        return null;
    }

    return (
        <I18nContext.Provider value={ctx}>
            <IntlProvider locale={locale} defaultLocale="en" messages={messages} onError={onError}>
                {children}
            </IntlProvider>
        </I18nContext.Provider>
    );
};

export default I18nProvider;
