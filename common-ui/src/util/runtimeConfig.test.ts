/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {getPortalName, getRuntimeConfig} from './runtimeConfig';

// Every case starts from "no config.js at all", the default an untouched deployment has.
beforeEach(() => {
    delete (window as any).APP_CONFIG;
    delete (window as any).APP_CONFIG_LOCAL;
});

describe('runtimeConfig', () => {
    it('is an empty object when config.js is absent, so no caller needs a null check', () => {
        expect(getRuntimeConfig()).toEqual({});
    });

    it('exposes whatever the deployment declared, i18n keys included', () => {
        (window as any).APP_CONFIG = {PORTAL_NAME: 'NBN Atlas', I18N_DEFAULT_LOCALE: 'es'};
        expect(getRuntimeConfig().PORTAL_NAME).toBe('NBN Atlas');
        expect(getRuntimeConfig().I18N_DEFAULT_LOCALE).toBe('es');
    });

    it('lets config.local.js override a default without dropping the others', () => {
        (window as any).APP_CONFIG = {PORTAL_NAME: 'Atlas of Living Australia', I18N_DEFAULT_LOCALE: 'en'};
        (window as any).APP_CONFIG_LOCAL = {PORTAL_NAME: 'NBN Atlas'};
        expect(getRuntimeConfig()).toEqual({PORTAL_NAME: 'NBN Atlas', I18N_DEFAULT_LOCALE: 'en'});
    });

    it('works with only config.local.js, since config.js may declare nothing', () => {
        (window as any).APP_CONFIG_LOCAL = {I18N_LOCALES: [{code: 'fr', label: 'Français'}]};
        expect(getRuntimeConfig().I18N_LOCALES).toHaveLength(1);
    });

    it('replaces a list outright rather than merging it, so removing a locale works', () => {
        (window as any).APP_CONFIG = {I18N_LOCALES: [{code: 'en', label: 'English'}, {code: 'es', label: 'Español'}]};
        (window as any).APP_CONFIG_LOCAL = {I18N_LOCALES: [{code: 'en', label: 'English'}]};
        expect(getRuntimeConfig().I18N_LOCALES).toEqual([{code: 'en', label: 'English'}]);
    });
});

describe('getPortalName', () => {
    it('returns the fallback when PORTAL_NAME is unset or blank', () => {
        expect(getPortalName('Atlas of Living Australia')).toBe('Atlas of Living Australia');
        (window as any).APP_CONFIG = {PORTAL_NAME: '  '};
        expect(getPortalName('Atlas of Living Australia')).toBe('Atlas of Living Australia');
    });

    it('returns the configured PORTAL_NAME when set', () => {
        (window as any).APP_CONFIG = {PORTAL_NAME: 'NBN Atlas'};
        expect(getPortalName('Atlas of Living Australia')).toBe('NBN Atlas');
    });
});
