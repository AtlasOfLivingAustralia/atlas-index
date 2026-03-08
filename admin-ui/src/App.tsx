/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    Banner,
    Breadcrumb,
    Breadcrumbs,
    checkLoginState,
    Footer,
    handleLogin,
    handleLogout,
    Header,
    injectCommonInfo,
    UserContext,
    UserInfo,
} from '@ala/common-ui';
import {useEffect, useRef, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import {Route, Routes} from 'react-router-dom';
import buildInfo from './buildInfo.json';
import AtlasAdmin from './views/AtlasAdmin.tsx';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Biocache from "./views/Biocache.tsx";
import DataQualityAdmin from './views/DataQualityAdmin.tsx';
import '@fontsource/roboto';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import Doi from "./views/Doi.tsx";
import Home from './views/Home.tsx';
import Tasks from "./views/Tasks.tsx";
import BannerMessages from "./views/BannerMessages.tsx";
import AuditHistory from "./views/AuditHistory.tsx";

export default function App() {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {
            title: 'Home',
            href: import.meta.env.VITE_HOME_URL,
        },
    ]);

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const refreshTimer = useRef<NodeJS.Timeout | null>(null);

    // Common UI
    useEffect(() => {
        injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_JS, import.meta.env.VITE_COMMON_CSS, setCssLoaded);

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
        <main>
            <UserContext.Provider value={{userInfo, setUserInfo}}>
                <Header isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper}
                        headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}/>

                <Breadcrumbs breadcrumbs={breadcrumbs}/>

                <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE}/>

                <div className="mt-4"/>

                {userInfo?.roles?.includes(import.meta.env.VITE_ADMIN_ROLE) ? (
                    <Routes>
                        <Route path="/"
                               element={<Home setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/search" element={<AtlasAdmin
                            setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/dq" element={<DataQualityAdmin
                            setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/tasks"
                               element={<Tasks setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/doi"
                               element={<Doi setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/biocache"
                               element={<Biocache setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/banners"
                               element={<BannerMessages setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/audit"
                               element={<AuditHistory setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    </Routes>
                ) : (
                    <div style={{display: 'flex', height: '100vh', justifyContent: 'center', marginTop: '60px'}}>
                        {userInfo?.authenticated ? <div>Insufficient permissions.</div> : <div>Admin login required</div>}
                    </div>
                )}

                <div className="mt-4"/>

                <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper}
                        footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML}/>
            </UserContext.Provider>
        </main>
    );
}
