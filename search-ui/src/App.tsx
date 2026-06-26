/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Banner, Breadcrumb, Breadcrumbs, checkLoginState, Footer, handleLogin, handleLogout, Header, injectCommonInfo, NotFound, UserContext, UserInfo } from '@ala/common-ui';
import React, {useEffect, useRef, useState} from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import buildInfo from './buildInfo.json';
import Search from './views/Search.tsx';
import Species from './views/Species';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

const SearchRedirect: React.FC = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const to = q ? `/?q=${encodeURIComponent(q)}` : '/';
    return <Navigate to={to} replace />;
};

const App: React.FC = () => {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Search', href: '/'},
    ]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_CSS, setCssLoaded);

        checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const handleResize = () =>
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    function handleLoginWrapper() {
        handleLogin(import.meta.env.VITE_APP_API_URL);
    }

    function handleLogoutWrapper() {
        handleLogout(import.meta.env.VITE_APP_API_URL, import.meta.env.VITE_APP_BASE_URL);
    }

    if (!cssLoaded) {
        return <></>;
    }

    return <main>
        <UserContext.Provider value={{ userInfo, setUserInfo }}>
            <Header isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper}
                    headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML} searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX}
                    jsUrl={import.meta.env.VITE_COMMON_JS} containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}/>

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

            <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML} />
        </UserContext.Provider>
    </main>;
};

export default App;
