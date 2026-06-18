/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {ThemeConfig, fetchThemeConfig} from '../util/theme';
import {injectCommonInfo} from '../util/utils';

interface UseThemeOptions {
    themeConfigUrl: string; // value of VITE_THEME_CONFIG_URL ('' => use fallbackTheme)
    fallbackTheme: ThemeConfig; // built-in defaults, typically derived from VITE_* env vars
    buildInfo: any;
    env: string;
}

export interface UseThemeResult {
    cssLoaded: boolean; // mirrors the existing injectCommonInfo gate
    themeConfig: ThemeConfig | null; // resolved theme (manifest or fallback)
}

/**
 * Minimal runtime-theme hook. Replaces the per-UI `injectCommonInfo` useEffect: it resolves a
 * theme manifest (or the env-var fallback) and injects its CSS, then exposes the resolved
 * config so the caller can wire header/footer/logo URLs into <Header>/<Footer>.
 *
 * Locale switching is intentionally NOT handled here yet (see SPEC.md "Deferred"); the
 * existing IntlProvider in each UI's main.tsx is left untouched.
 */
export function useTheme({themeConfigUrl, fallbackTheme, buildInfo, env}: UseThemeOptions): UseThemeResult {
    const [cssLoaded, setCssLoaded] = useState(false);
    const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchThemeConfig(themeConfigUrl, fallbackTheme).then((cfg) => {
            if (cancelled) return;
            setThemeConfig(cfg);
            injectCommonInfo(buildInfo, env, cfg.cssUrls.join(','), setCssLoaded);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return {cssLoaded, themeConfig};
}
