/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createContext, useContext } from 'react';

export type UserInfo = {
    authenticated: boolean; // whether the user is logged in
    userId?: string; // user's unique identifier
    email?: string; // user's email address
    firstName?: string; // user's given name
    lastName?: string; // user's family name
    roles?: string[]; // user roles
    accessToken?: string; // JWT access token
    expiresAt?: number; // access token expiry time (epoch seconds)
};

export const UserContext = createContext<{
    userInfo: UserInfo | null; // null userInfo means it is unknown whether the user is logged in or not yet
    setUserInfo: (info: UserInfo) => void;
}>({
    userInfo: null,
    setUserInfo: () => {}
});

export const useUser = () => useContext(UserContext);
