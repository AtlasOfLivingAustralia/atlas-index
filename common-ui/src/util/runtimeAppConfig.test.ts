/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {getAppConfigValue} from './runtimeAppConfig';

beforeEach(() => {
    delete (window as any).APP_CONFIG;
    delete (window as any).APP_CONFIG_LOCAL;
});

describe('getAppConfigValue', () => {
    it('returns the fallback when config.js is absent', () => {
        expect(getAppConfigValue('VITE_APP_BIOCACHE_URL', 'https://biocache-ws.ala.org.au/ws')).toBe(
            'https://biocache-ws.ala.org.au/ws'
        );
    });

    it('returns the fallback when the key is unset or blank', () => {
        (window as any).APP_CONFIG = {VITE_APP_BIOCACHE_URL: '  '};
        expect(getAppConfigValue('VITE_APP_BIOCACHE_URL', 'https://biocache-ws.ala.org.au/ws')).toBe(
            'https://biocache-ws.ala.org.au/ws'
        );
    });

    it('returns the value declared in config.js', () => {
        (window as any).APP_CONFIG = {VITE_APP_BIOCACHE_URL: 'https://records-ws.example.org/ws'};
        expect(getAppConfigValue('VITE_APP_BIOCACHE_URL', 'https://biocache-ws.ala.org.au/ws')).toBe(
            'https://records-ws.example.org/ws'
        );
    });

    it('lets config.local.js override config.js', () => {
        (window as any).APP_CONFIG = {VITE_APP_API_URL: 'https://api.ala.org.au'};
        (window as any).APP_CONFIG_LOCAL = {VITE_APP_API_URL: 'https://search.example.org'};
        expect(getAppConfigValue('VITE_APP_API_URL', 'https://api.ala.org.au')).toBe(
            'https://search.example.org'
        );
    });

    it('works for non-URL keys the same as the URL keys', () => {
        (window as any).APP_CONFIG_LOCAL = {VITE_APP_ROLE_ADMIN: 'ROLE_PORTAL_ADMIN'};
        expect(getAppConfigValue('VITE_APP_ROLE_ADMIN', 'ROLE_ADMIN')).toBe('ROLE_PORTAL_ADMIN');
    });
});
