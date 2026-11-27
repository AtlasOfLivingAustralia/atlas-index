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

    it('returns the fallback when the key is unset or null', () => {
        (window as any).APP_CONFIG = {VITE_APP_API_URL: 'https://search.example.org', VITE_APP_BIOCACHE_URL: null};
        expect(getAppConfigValue('VITE_APP_BIOCACHE_URL', 'https://biocache-ws.ala.org.au/ws')).toBe(
            'https://biocache-ws.ala.org.au/ws'
        );
        expect(getAppConfigValue('VITE_APP_IMAGES_URL', 'https://images.ala.org.au')).toBe('https://images.ala.org.au');
    });

    it('lets a deployment clear a setting the build fills in', () => {
        (window as any).APP_CONFIG_LOCAL = {VITE_GLOBAL_FQ: ''};
        expect(getAppConfigValue('VITE_GLOBAL_FQ', '&fq=spatiallyValid%3Atrue')).toBe('');
    });

    it('lets config.local.js clear a value config.js declares', () => {
        (window as any).APP_CONFIG = {VITE_QUERY_CONTEXT: 'data_hub_uid:dh1'};
        (window as any).APP_CONFIG_LOCAL = {VITE_QUERY_CONTEXT: ''};
        expect(getAppConfigValue('VITE_QUERY_CONTEXT', 'data_hub_uid:dh0')).toBe('');
    });

    it('reads numbers and booleans as strings, like .env values', () => {
        (window as any).APP_CONFIG_LOCAL = {VITE_MAP_CENTRE_LAT: 40.2, VITE_LEAFLET_MAP_ENABLED: false};
        expect(getAppConfigValue('VITE_MAP_CENTRE_LAT', '-25')).toBe('40.2');
        expect(getAppConfigValue('VITE_LEAFLET_MAP_ENABLED', 'true')).toBe('false');
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
