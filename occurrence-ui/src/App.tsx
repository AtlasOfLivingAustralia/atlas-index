/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Banner, Breadcrumb, Breadcrumbs, checkLoginState, Footer, handleLogin, handleLogout, Header, HeaderLanguageSwitcher, injectCommonInfo, NotFound, UserContext, UserInfo } from '@ala/common-ui';
import { useEffect, useRef, useState } from 'react';
import './index.css';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import buildInfo from './buildInfo.json';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import FooterAvh from "./components/avh/footerAvh.tsx";
import HeaderAvh from "./components/avh/headerAvh.tsx";
import FooterOzcam from './components/ozcam/footerOzcam.tsx';
import HeaderOzcam from './components/ozcam/headerOzcam.tsx';
import CustomDownload from './views/CustomDownload.tsx';
import Download from './views/Download.tsx';
import DownloadStatus from './views/DownloadStatus.tsx';
import ExploreYourArea from './views/ExploreYourArea.tsx';
import Fields from './views/Fields.tsx';
import Occurrence from './views/Occurrence.tsx';
import OccurrenceList from './views/OccurrenceList.tsx';
import OccurrenceSearch from './views/OccurrenceSearch.tsx';

//const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

// Redirects to `to`, preserving the current query string. Defined outside App
// so it isn't recreated (and remounted) on every render.
function RedirectWithSearch({ to }: { to: string }) {
    const location = useLocation();
    return <Navigate to={`${to}${location.search}`} replace />;
}

function NotFoundWithBreadcrumbs({ setBreadcrumbs }: { setBreadcrumbs: (b: Breadcrumb[]) => void }) {
    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Occurrence records', href: '/' },
            { title: 'Not Found', href: '#' }
        ]);
    }, [setBreadcrumbs]);
    return <NotFound />;
}

export default function App() {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ title: 'Home', href: import.meta.env.VITE_HOME_URL }]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    // const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_CSS, setCssLoaded);

        checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);

        if (import.meta.env.VITE_SKIN === 'OZCAM') {
            import('./ozcam.css');
        } else if (import.meta.env.VITE_SKIN === 'AVH') {
            import('./avh.css');
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // const handleResize = () => {
        //     setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        // };
        // window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // window.removeEventListener('resize', handleResize);
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

    return (
        <main>
            <UserContext.Provider value={{ userInfo, setUserInfo }}>
                {import.meta.env.VITE_SKIN === 'ALA' && (
                    <Header
                        isLoggedIn={userInfo?.authenticated}
                        logoutFn={handleLogoutWrapper}
                        loginFn={handleLoginWrapper}
                        headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}
                        searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX}
                        jsUrl={import.meta.env.VITE_COMMON_JS}
                        containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}
                    />
                )}
                {import.meta.env.VITE_SKIN === 'OZCAM' && <HeaderOzcam />}
                {import.meta.env.VITE_SKIN === 'AVH' && (
                    <HeaderAvh
                        handleLoginFn={handleLoginWrapper}
                        handleLogoutFn={handleLogoutWrapper}
                    />
                )}

                {import.meta.env.VITE_HEADER_LANGUAGE_SWITCHER_ENABLED === 'true' && <HeaderLanguageSwitcher />}
                {import.meta.env.VITE_SKIN === 'ALA' && <Breadcrumbs breadcrumbs={breadcrumbs} />}

                <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE} />

                <div style={{ marginTop: '20px' }} />

                <Routes>
                    <Route path='/search/*' element={<Navigate to='/' replace />} />
                    <Route path='/' element={<OccurrenceSearch setBreadcrumbs={setBreadcrumbs} /*isMobile={isMobile}*/ />} />
                    <Route path='/occurrences/search' element={<OccurrenceList setBreadcrumbs={setBreadcrumbs} /*isMobile={isMobile}*/ />} />

                    {/* deprecated path */}
                    <Route path='/occurrence/search' element={<RedirectWithSearch to='/occurrences/search' />} />

                    <Route path='/occurrence/:uuid' element={<Occurrence setBreadcrumbs={setBreadcrumbs} /*isMobile={isMobile}*/ />} />
                    <Route path='/explore/your-area' element={<ExploreYourArea setBreadcrumbs={setBreadcrumbs} /*isMobile={isMobile}*/ />} />
                    <Route path='/download/options1' element={<Download setBreadcrumbs={setBreadcrumbs} /*isMobile={isMobile}*/ />} />
                    <Route path='/download/options2' element={<CustomDownload setBreadcrumbs={setBreadcrumbs} />} />
                    <Route path='/download/confirm' element={<DownloadStatus setBreadcrumbs={setBreadcrumbs} />} />
                    <Route path='/fields' element={<Fields setBreadcrumbs={setBreadcrumbs} />} />
                    <Route path='*' element={<NotFoundWithBreadcrumbs setBreadcrumbs={setBreadcrumbs} />} />
                </Routes>

                <div className='mt-4' />

                {import.meta.env.VITE_SKIN === 'ALA' && <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML} />}
                {import.meta.env.VITE_SKIN === 'OZCAM' && <FooterOzcam />}
                {import.meta.env.VITE_SKIN === 'AVH' && <FooterAvh />}
            </UserContext.Provider>
        </main>
    );
}
