/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Check the login state of the user by calling the /session endpoint.
 *
 * Sets the user info via setUserInfo.
 *
 * Schedules a refresh of the login state before the access token expires.
 *
 * @param setUserInfo
 * @param refreshTimer
 */
export function checkLoginState(setUserInfo: (info: any) => void, refreshTimer: { current: NodeJS.Timeout | null }, apiUrl: string) {
    // Clear previous timer before doing anything because it could fire while we are fetching
    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    fetch(apiUrl + '/session', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            setUserInfo({
                authenticated: data.authenticated,
                userId: data.userId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                roles: data.roles,
                accessToken: data.accessToken,
                expiresAt: data.expiresAt
            });

            // Schedule refresh if expiresAt is set
            if (data.expiresAt) {
                // ms
                const now = Date.now(); // ms
                const msToExpiry = data.expiresAt - now;

                // Stagger: random between 1 and 2 minutes before expiry
                const staggerMs = (Math.floor(Math.random() * 60) + 60) * 10;

                // may trigger immediately if close to expiry
                const timeoutMs = Math.max(msToExpiry - staggerMs, 0);

                refreshTimer.current = setTimeout(() => {
                    checkLoginState(setUserInfo, refreshTimer, apiUrl);
                }, timeoutMs);
            }
        })
        .catch(() => setUserInfo(null));
}

// Redirect to the login page with a return path to the current page
export function handleLogin(apiUrl: string) {
    window.location.href = apiUrl + '/login?path=' + encodeURIComponent(window.location.href);
}

// Redirect to the logout page with a return path to the app base URL (as it must be registered with the auth provider)
export function handleLogout(apiUrl: string, baseUrl: string) {
    window.location.href = apiUrl + '/logout?path=' + baseUrl;
}
