/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import 'bootstrap/dist/css/bootstrap.css';
import Biocache from "./views/Biocache.tsx";
import Doi from "./views/Doi.tsx";
import Home from './views/Home.tsx';
import AtlasAdmin from './views/AtlasAdmin.tsx';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import DataQualityAdmin from './views/DataQualityAdmin.tsx';
import '@fontsource/roboto';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {
    Banner,
    Header,
    Footer,
    injectCommonInfo,
    Breadcrumbs,
    Breadcrumb,
} from '@ala/common-ui';
import buildInfo from './buildInfo.json';
import Tasks from "./views/Tasks.tsx";

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {
            title: 'Home',
            href: import.meta.env.VITE_HOME_URL,
        },
    ]);

    const auth = useAuth();

    // Common UI
    useEffect(() => {
        injectCommonInfo(
            buildInfo,
            import.meta.env.VITE_ENV,
            import.meta.env.VITE_COMMON_JS,
            import.meta.env.VITE_COMMON_CSS,
            setCssLoaded
        );
    }, []);

    useEffect(() => {
        setIsLoggedIn(auth.isAuthenticated);
    }, [auth]);

    // Do silent login when visiting this page after access token expires but before refresh token expires.
    useEffect(() => {
        if (!auth.events) return;
        const handler = () => {
            void auth.signinSilent();
        };
        auth.events.addAccessTokenExpired(handler);
        return () => {
            auth.events.removeAccessTokenExpired(handler);
        };
    }, [auth.events, auth.signinSilent]);

    useEffect(() => {
        // interval silent signin retry is only required for specific errors
        if (!auth.error ||
            // seen when the network is not yet connected, e.g. waking device from sleep
            !(auth.error.source == 'signinSilent' && auth.error.message == 'Failed to fetch')) {
            return;
        }

        const interval = setInterval(() => {
            auth.signinSilent();
        }, 500);
        return () => clearInterval(interval);
    }, [auth.error]);

    switch (auth.activeNavigator) {
        case 'signinSilent':
            return <div>Signing you in...</div>
        case 'signoutRedirect':
            return (<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                <div className="d-flex flex-column align-items-center">
                    <div>Signing you out...</div>
                </div>
            </div>);
    }

    if (auth.isLoading) {
        return (<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
            <div className="d-flex flex-column align-items-center">
                <div>Loading...</div>
            </div>
        </div>);
    }

    if (auth.error) {
        return (
            <div className="d-flex flex-column align-items-center">
                <div>Oops... {auth.error.source} caused {auth.error.message}, retrying</div>


                <button className="btn btn-primary mt-5 ms-2"
                        onClick={() => void auth.signinSilent()}>Retry</button>
                <button className="btn btn-primary mt-2 ms-2"
                        onClick={handleLogin}>Login Again</button>
                <button className="btn btn-primary mt-2 ms-2"
                        onClick={handleLogout}>Logout</button>
            </div>
        );
    }

    // when receiving a login URL, handle the login by setting the auth cookie only
    function handleLogin() {
        auth.signinRedirect();
        // if (import.meta.env.MODE === 'production') {
        //     // do login that is suitable for an application that has no authentication requirement (redirect another app)
        //     window.location.href = import.meta.env.VITE_LOGIN_URL;
        // } else {
        //     // simulate login by setting the cookie and state
        //     document.cookie = `${import.meta.env.VITE_AUTH_COOKIE}loggedIn; expires=Thu, 01 Jul 2025 00:00:00 UTC; path=/; domain=${import.meta.env.VITE_AUTH_COOKIE_DOMAIN}`;
        //     setIsLoggedIn(true);
        // }
    }

    function handleLogout() {
        auth.removeUser();
        // // remove cookie
        // document.cookie = `${import.meta.env.VITE_AUTH_COOKIE}loggedIn; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${import.meta.env.VITE_AUTH_COOKIE_DOMAIN}`;
        //
        // setIsLoggedIn(false);
    }

    if (!cssLoaded) {
        return <></>;
    }

    const roles = Array.isArray(auth.user?.profile?.[import.meta.env.VITE_PROFILE_ROLES])
            ? auth.user.profile[import.meta.env.VITE_PROFILE_ROLES] as string[] : [];
    const isAdmin = auth.isAuthenticated && roles.includes(import.meta.env.VITE_ADMIN_ROLE);

    return (
        <main>
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

            <div className="mt-4" />

            {isAdmin && (
                <Routes>
                    <Route path="/" element={<Home setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/search" element={<AtlasAdmin setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/dq" element={<DataQualityAdmin setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/tasks" element={<Tasks setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/doi" element={<Doi setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)} />}/>
                    <Route path="/biocache" element={<Biocache setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)} />}/>
                </Routes>
            )}

            {!isAdmin && (
                <div className="d-flex justify-content-center py-5">
                    Admin login required
                </div>
            )}

            <div className="mt-4" />

            <Footer
                isLoggedIn={isLoggedIn}
                logoutFn={handleLogout}
                loginFn={handleLogin}
                footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML}
            />
        </main>
    );
}
