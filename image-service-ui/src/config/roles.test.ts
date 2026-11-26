/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {canEdit, hasRole, isAdmin, isImageAdmin} from './roles';
import type {UserInfo} from '@ala/common-ui';

describe('roles', () => {
    const admin: UserInfo = {authenticated: true, roles: ['ROLE_USER', 'ROLE_ADMIN']};
    const imageAdmin: UserInfo = {authenticated: true, roles: ['ROLE_USER', 'ROLE_IMAGE_ADMIN']};
    const plainUser: UserInfo = {authenticated: true, roles: ['ROLE_USER']};

    it('hasRole checks membership in the roles array', () => {
        expect(hasRole(admin, 'ROLE_ADMIN')).toBe(true);
        expect(hasRole(plainUser, 'ROLE_ADMIN')).toBe(false);
        expect(hasRole(null, 'ROLE_ADMIN')).toBe(false);
        expect(hasRole(undefined, 'ROLE_ADMIN')).toBe(false);
    });

    it('isAdmin grants access to ROLE_ADMIN and ROLE_IMAGE_ADMIN', () => {
        expect(isAdmin(admin)).toBe(true);
        expect(isAdmin(imageAdmin)).toBe(true);
        expect(isAdmin(plainUser)).toBe(false);
        expect(isAdmin(null)).toBe(false);
    });

    it('isImageAdmin only recognises ROLE_IMAGE_ADMIN', () => {
        expect(isImageAdmin(imageAdmin)).toBe(true);
        expect(isImageAdmin(admin)).toBe(false);
    });

    it('canEdit only requires an authenticated session, not a specific role', () => {
        expect(canEdit(plainUser)).toBe(true);
        expect(canEdit({authenticated: false})).toBe(false);
        expect(canEdit(null)).toBe(false);
    });
});
