/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Banner, Breadcrumb, Breadcrumbs, checkLoginState, Footer, handleLogin, handleLogout, Header, injectCommonInfo, UserContext, UserInfo } from '@ala/common-ui';
import { useEffect, useRef, useState } from 'react';
import './index.css';
import { Route, Routes } from 'react-router-dom';
import buildInfo from './buildInfo.json';
import SensitiveDataServicePage from './views/SensitiveDataServicePage.tsx';

export default function App() {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {
            title: 'Home',
            href: import.meta.env.VITE_HOME_URL
        }
    ]);

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

    function handleLoginWrapper() {
        handleLogin(import.meta.env.VITE_APP_API_URL);
    }

    function handleLogoutWrapper() {
        handleLogout(import.meta.env.VITE_APP_API_URL, import.meta.env.VITE_APP_BASE_URL);
    }

    if (!cssLoaded) {
        return <></>;
    }

    return (
        <UserContext.Provider value={{ userInfo, setUserInfo }}>
            <Header
                isLoggedIn={userInfo?.authenticated}
                logoutFn={handleLogoutWrapper}
                loginFn={handleLoginWrapper}
                headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}
                searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX}
                jsUrl={import.meta.env.VITE_COMMON_JS}
                containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}
            />

            <Breadcrumbs breadcrumbs={breadcrumbs} />

            <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE} />

            <div className='mt-4' />

            <Routes>
                <Route path='/' element={<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />} />
            </Routes>

            <div className='mt-4' />

            <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML} />
        </UserContext.Provider>
    );
}
