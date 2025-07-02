/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Species from './views/Species';
import 'bootstrap/dist/css/bootstrap.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import buildInfo from './buildInfo.json';
import Search from './views/Search.tsx';
import {
    Banner,
    Breadcrumb,
    Breadcrumbs,
    Footer,
    Header,
    injectCommonInfo,
    NotFound,
} from '@ala/common-ui';

const isLoggedInInitial = document.cookie.includes(
    import.meta.env.VITE_AUTH_COOKIE
);

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        { title: 'Home', href: import.meta.env.VITE_HOME_URL },
        { title: 'Search', href: '/' },
    ]);
    const [_, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        const handleResize = () =>
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        injectCommonInfo(
            buildInfo,
            import.meta.env.VITE_ENV,
            import.meta.env.VITE_COMMON_JS,
            import.meta.env.VITE_COMMON_CSS,
            setCssLoaded
        );
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

    return (
        <>
            <Header
                isLoggedIn={isLoggedIn}
                logoutFn={handleLogout}
                loginFn={handleLogin}
                headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}
            />

            <Breadcrumbs breadcrumbs={breadcrumbs} />

            <Banner
                bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL}
                scope={import.meta.env.VITE_BANNER_SCOPE}
            />

            <Routes>
                <Route
                    path="/species/*"
                    element={
                        <Species
                            setBreadcrumbs={(crumbs: Breadcrumb[]) =>
                                setBreadcrumbs(crumbs)
                            }
                        />
                    }
                />
                <Route
                    path="/"
                    element={
                        <Search
                            setBreadcrumbs={(crumbs: Breadcrumb[]) =>
                                setBreadcrumbs(crumbs)
                            }
                        />
                    }
                />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <div style={{ height: '60px' }} />

            <Footer
                isLoggedIn={isLoggedIn}
                logoutFn={handleLogout}
                loginFn={handleLogin}
                footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML}
            />
        </>
    );
};

export default App;
