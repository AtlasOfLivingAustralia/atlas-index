/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {ThemeConfig} from '@ala/common-ui';

/**
 * Built-in fallback theme, derived from the existing VITE_* env vars. Used whenever
 * VITE_THEME_CONFIG_URL is unset or its manifest fails to load, so behaviour is identical to
 * the pre-theme code path.
 */
export const ALA_DEFAULT_THEME: ThemeConfig = {
    cssUrls: [import.meta.env.VITE_COMMON_CSS ?? ''],
    jsUrls: [import.meta.env.VITE_COMMON_JS ?? ''],
    headerUrl: import.meta.env.VITE_COMMON_HEADER_HTML ?? '',
    footerUrl: import.meta.env.VITE_COMMON_FOOTER_HTML ?? '',
    logoUrl: import.meta.env.VITE_LOGO_URL ?? 'https://www.ala.org.au/app/uploads/2019/01/logo.png',
    homeUrl: import.meta.env.VITE_HOME_URL ?? '/',
    defaultLocale: 'en',
    locales: [{code: 'en', label: 'English', messagesUrl: ''}],
};
