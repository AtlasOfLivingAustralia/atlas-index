/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Banner, Breadcrumb, Breadcrumbs, Footer, Header, getRuntimeConfig, NotFound, useTheme,} from '@ala/common-ui';
import React, {useEffect, useState} from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import buildInfo from './buildInfo.json';
import {ALA_DEFAULT_THEME} from './config/alaDefaultTheme';
import Search from './views/Search.tsx';
import Species from './views/Species';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const isLoggedInInitial = document.cookie.includes(import.meta.env.VITE_AUTH_COOKIE);

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

const SearchRedirect: React.FC = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const to = q ? `/?q=${encodeURIComponent(q)}` : '/';
    return <Navigate to={to} replace />;
};

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
    const {cssLoaded, themeConfig} = useTheme({
        // Runtime pointer (window.APP_CONFIG via /config.js) so a prebuilt app can be branded
        // per portal with no rebuild; falls back to the build-time VITE_ value.
        themeConfigUrl: getRuntimeConfig('VITE_THEME_CONFIG_URL', import.meta.env.VITE_THEME_CONFIG_URL ?? ''),
        fallbackTheme: ALA_DEFAULT_THEME,
        buildInfo,
        env: import.meta.env.VITE_ENV,
    });
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Search', href: '/'},
    ]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        const handleResize = () =>
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // when receiving a login URL, handle the login by setting the auth cookie only
    function handleLogin() {
        if (import.meta.env.MODE === 'production') {
            // do login that is suitable for an application that has no authentication requirement (redirect another app)
            window.location.href = import.meta.env.VITE_LOGIN_URL;
        } else {
            // simulate login by setting the cookie and state
            document.cookie = `${import.meta.env.VITE_AUTH_COOKIE}loggedIn; expires=Thu, 01 Jul 2025 00:00:00 UTC; path=/; domain=${import.meta.env.VITE_AUTH_COOKIE_DOMAIN}`;
            setIsLoggedIn(true);
        }
    }

    function handleLogout() {
        // remove cookie
        document.cookie = `${import.meta.env.VITE_AUTH_COOKIE}loggedIn; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${import.meta.env.VITE_AUTH_COOKIE_DOMAIN}`;

        setIsLoggedIn(false);
    }

    if (!cssLoaded) {
        return <></>;
    }

    return <>
        <Header
            isLoggedIn={isLoggedIn}
            logoutFn={handleLogout}
            loginFn={handleLogin}
            headerUrl={themeConfig?.headerUrl ?? import.meta.env.VITE_COMMON_HEADER_HTML}
            searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX}
            jsUrl={themeConfig?.jsUrls.join(',') ?? import.meta.env.VITE_COMMON_JS}
            containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}
            logoUrl={themeConfig?.logoUrl}
        />

        <Breadcrumbs breadcrumbs={breadcrumbs}/>

        <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE}/>

        <Routes>
            <Route path="/species/*"
                   element={<Species setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                     isMobile={isMobile}/>}/>
            <Route path="/" element={<Search setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                             isMobile={isMobile}/>}/>
            <Route path="*" element={<NotFound/>}/>

            {/* Deprecated legacy routes */}
            <Route path="/search" element={<SearchRedirect />} />
        </Routes>
        <div style={{height: '60px', backgroundColor: isMobile ? '#E7E7E7' : '#FFFFFF'}}/>

        <Footer
            isLoggedIn={isLoggedIn}
            logoutFn={handleLogout}
            loginFn={handleLogin}
            footerUrl={themeConfig?.footerUrl ?? import.meta.env.VITE_COMMON_FOOTER_HTML}
            logoUrl={themeConfig?.logoUrl}
        />
    </>;
};

export default App;
