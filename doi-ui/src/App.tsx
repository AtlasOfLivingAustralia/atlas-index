/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'bootstrap/dist/css/bootstrap.css';
import {
    Banner,
    Breadcrumb,
    Breadcrumbs,
    checkLoginState,
    Footer,
    handleLogin,
    handleLogout,
    Header,
    injectCommonInfo, NotFound,
    UserContext,
    UserInfo
} from '@ala/common-ui';
import {useEffect, useRef, useState} from 'react';
import './index.css';
import {Route, Routes} from 'react-router-dom';
import buildInfo from './buildInfo.json';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource/roboto';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import Doi from './views/Doi.tsx';
import Home from './views/Home.tsx';
import MyDownloads from './views/MyDownloads.tsx';

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

export default function App() {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
    ]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    const refreshTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_JS, import.meta.env.VITE_COMMON_CSS, setCssLoaded);

        checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const handleResize = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    if (!cssLoaded) {
        return <></>;
    }

    function handleLoginWrapper() {
        handleLogin(import.meta.env.VITE_APP_API_URL);
    }

    function handleLogoutWrapper() {
        handleLogout(import.meta.env.VITE_APP_API_URL, import.meta.env.VITE_APP_BASE_URL);
    }

    function NotFoundWithBreadcrumbs({ setBreadcrumbs }: { setBreadcrumbs: (b: Breadcrumb[]) => void }) {
        useEffect(() => {
            setBreadcrumbs([
                {title: 'Home', href: import.meta.env.VITE_HOME_URL},
                {title: 'ALA DOI Repository', href: '/'},
                { title: 'Not Found', href: '#' }]);
        }, [setBreadcrumbs]);
        return <NotFound />;
    }

    return (
        <main>
            <UserContext.Provider value={{ userInfo, setUserInfo }}>
                <Header isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML} />

                <Breadcrumbs breadcrumbs={breadcrumbs} />

                <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE} />

                <Routes>
                    <Route path='/' element={<Home setBreadcrumbs={setBreadcrumbs} isMobile={isMobile} />} />
                    <Route path='/myDownloads' element={<MyDownloads setBreadcrumbs={setBreadcrumbs} isMobile={isMobile} />} />
                    <Route path='/doi/:entityUid?' element={<Doi setBreadcrumbs={setBreadcrumbs} isMobile={isMobile} />} />
                    <Route path="*" element={<NotFoundWithBreadcrumbs setBreadcrumbs={setBreadcrumbs} />}/>
                </Routes>

                <div className='mt-4' />

                <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML} />
            </UserContext.Provider>
        </main>
    );
}
