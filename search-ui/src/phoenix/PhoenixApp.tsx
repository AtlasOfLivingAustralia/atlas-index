/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Banner, checkLoginState, handleLogin, handleLogout, UserContext, UserInfo} from '@ala/common-ui';
import {Acknowledgement, Footer, Header, initializeTheme, type ThemePreference} from '@ala/ui';
import {useEffect, useRef, useState} from 'react';
import PhoenixSearch from './PhoenixSearch';

const api = import.meta.env.VITE_APP_API_URL;
// Same key as the currawong skin, so a dismissal carries across ALA pages.
const ACK_DISMISSED_KEY = 'ala-ack-banner-dismissed';

export default function PhoenixApp() {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [theme, setTheme] = useState<ThemePreference>('light');
    const [ackDismissed, setAckDismissed] = useState(() => localStorage.getItem(ACK_DISMISSED_KEY) === 'true');
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const signedIn = !!userInfo?.authenticated;

    useEffect(() => checkLoginState(setUserInfo, refreshTimer, api), []);
    useEffect(() => initializeTheme(theme), [theme]);

    return <UserContext.Provider value={{userInfo, setUserInfo}}>
        <Header
            homeHref={import.meta.env.VITE_HOME_URL}
            banner={!ackDismissed && <Acknowledgement variant="banner" onClose={() => {
                localStorage.setItem(ACK_DISMISSED_KEY, 'true');
                setAckDismissed(true);
            }}/>}
            signedIn={signedIn}
            onSignIn={() => handleLogin(api)}
            onSignOut={() => handleLogout(api, import.meta.env.VITE_APP_BASE_URL)}
            onSearch={() => document.getElementById('phoenix-search')?.focus()}
            onThemeToggle={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
        />
        {/* Existing raw-Bootstrap common-ui component, unchanged, to test coexistence. */}
        <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE}/>
        <main id="main">
            <PhoenixSearch/>
        </main>
        <Footer/>
    </UserContext.Provider>;
}
