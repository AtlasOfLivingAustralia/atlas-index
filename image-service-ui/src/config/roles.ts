/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {UserInfo} from '@ala/common-ui';

/**
 * Role checks are client-side presentation only (show/hide admin nav,
 * gate authenticated action buttons). The backend remains authoritative —
 * every mutating `/api/v2` call is still enforced server-side against the
 * session, so a user cannot gain access merely by forcing these checks.
 */
export function hasRole(userInfo: UserInfo | null | undefined, role: string): boolean {
    return !!userInfo?.roles?.includes(role);
}

/**
 * Keep this aligned with the DOI UI/search-service session contract, which
 * exposes the authenticated user's roles through `UserInfo.roles`.
 */
export function isAdmin(userInfo: UserInfo | null | undefined): boolean {
    return hasRole(userInfo, import.meta.env.VITE_APP_ROLE_ADMIN) || hasRole(userInfo, import.meta.env.VITE_APP_ROLE_IMAGE_ADMIN);
}

export function isImageAdmin(userInfo: UserInfo | null | undefined): boolean {
    return hasRole(userInfo, import.meta.env.VITE_APP_ROLE_IMAGE_ADMIN);
}

/** Any authenticated user may edit metadata/tags/subimages on images they can see; deletion is further restricted by ownership + admin role server-side. */
export function canEdit(userInfo: UserInfo | null | undefined): boolean {
    return !!userInfo?.authenticated;
}
