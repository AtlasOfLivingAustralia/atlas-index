/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {getThemeValue} from './runtimeTheme';

beforeEach(() => {
    delete (window as any).APP_CONFIG;
    delete (window as any).APP_CONFIG_LOCAL;
});

describe('getThemeValue', () => {
    it('returns the fallback when config.js is absent', () => {
        expect(getThemeValue('THEME_HEADER_URL', 'https://ala.org.au/banner.mustache')).toBe(
            'https://ala.org.au/banner.mustache'
        );
    });

    it('returns the fallback when the key is unset or blank', () => {
        (window as any).APP_CONFIG = {THEME_HEADER_URL: '  '};
        expect(getThemeValue('THEME_HEADER_URL', 'https://ala.org.au/banner.mustache')).toBe(
            'https://ala.org.au/banner.mustache'
        );
    });

    it('returns the value declared in config.js', () => {
        (window as any).APP_CONFIG = {THEME_CSS_URL: 'https://example.org/theme.css'};
        expect(getThemeValue('THEME_CSS_URL', 'https://ala.org.au/ala-combined.css')).toBe(
            'https://example.org/theme.css'
        );
    });

    it('lets config.local.js override config.js', () => {
        (window as any).APP_CONFIG = {THEME_FOOTER_URL: 'https://ala.org.au/footer.mustache'};
        (window as any).APP_CONFIG_LOCAL = {THEME_FOOTER_URL: 'https://example.org/footer.mustache'};
        expect(getThemeValue('THEME_FOOTER_URL', 'https://ala.org.au/footer.mustache')).toBe(
            'https://example.org/footer.mustache'
        );
    });

    it('works for THEME_CONTAINER_CLASS the same as the URL keys', () => {
        (window as any).APP_CONFIG_LOCAL = {THEME_CONTAINER_CLASS: 'container'};
        expect(getThemeValue('THEME_CONTAINER_CLASS', 'container-fluid')).toBe('container');
    });
});
