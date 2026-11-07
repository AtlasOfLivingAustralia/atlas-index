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
    NotFound,
    UserContext,
    UserInfo
} from '@ala/common-ui';
import {useEffect, useRef, useState} from 'react';
import {Navigate, Route, Routes, useLocation, useParams} from 'react-router-dom';
import buildInfo from './buildInfo.json';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Search from './views/Search.tsx';
import ImageDetail from './views/ImageDetail.tsx';
import AdminHome from './views/admin/AdminHome.tsx';
import Upload from './views/admin/Upload.tsx';
import BatchStatus from './views/admin/BatchStatus.tsx';
import SearchCriteriaAdmin from './views/admin/SearchCriteriaAdmin.tsx';
import IndexSearch from './views/admin/IndexSearch.tsx';
import Tools from './views/admin/Tools.tsx';
import TagsAdmin from './views/admin/TagsAdmin.tsx';
import StorageLocationsAdmin from './views/admin/StorageLocationsAdmin.tsx';
import LicencesAdmin from './views/admin/LicencesAdmin.tsx';
import DuplicatesAdmin from './views/admin/DuplicatesAdmin.tsx';
import SettingsAdmin from './views/admin/SettingsAdmin.tsx';
import AnalyticsAdmin from './views/admin/AnalyticsAdmin.tsx';
import SwaggerView from './views/admin/SwaggerView.tsx';
import {isAdmin} from './config/roles.ts';

const MOBILE_BREAKPOINT = 768;

/** `/search?q=...` -> `/?q=...` (legacy image-service default action was `/search/list`; the new default route is `/`). */
function SearchRedirect() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    return <Navigate to={q ? `/?q=${encodeURIComponent(q)}` : '/'} replace/>;
}

/** `/admin/image/:imageId` (legacy AdminController#image) -> `/image/:imageId`. */
function AdminImageRedirect() {
    const {imageId} = useParams<{ imageId: string }>();
    return <Navigate to={`/image/${encodeURIComponent(imageId ?? '')}`} replace/>;
}

/** `/image/view/:imageId` (legacy ImageController#viewer) -> `/image/:imageId`. */
function ImageViewRedirect() {
    const {imageId} = useParams<{ imageId: string }>();
    return <Navigate to={`/image/${encodeURIComponent(imageId ?? '')}`} replace/>;
}

export default function App() {
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Images', href: '/'}
    ]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_CSS, setCssLoaded);

        checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_AUTH_URL);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_AUTH_URL);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
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
        handleLogin(import.meta.env.VITE_APP_AUTH_URL);
    }

    function handleLogoutWrapper() {
        handleLogout(import.meta.env.VITE_APP_AUTH_URL, import.meta.env.VITE_APP_BASE_URL);
    }

    const setCrumbs = (crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs);

    return (
        <main>
            <UserContext.Provider value={{userInfo, setUserInfo}}>
                <Header isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper}
                        headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML} searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX}
                        jsUrl={import.meta.env.VITE_COMMON_JS} containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}/>

                <Breadcrumbs breadcrumbs={breadcrumbs}/>

                <Banner bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL} scope={import.meta.env.VITE_BANNER_SCOPE}/>

                <div className="mt-4"/>

                <Routes>
                    {/* Public: search + image/media detail */}
                    <Route path="/" element={<Search setBreadcrumbs={setCrumbs} isMobile={isMobile}/>}/>
                    <Route path="/image/:imageId" element={<ImageDetail setBreadcrumbs={setCrumbs}/>}/>

                    {/* Legacy route compatibility */}
                    <Route path="/search" element={<SearchRedirect/>}/>
                    <Route path="/image/view/:imageId" element={<ImageViewRedirect/>}/>
                    <Route path="/admin/image/:imageId" element={<AdminImageRedirect/>}/>

                    {/* Admin — gated on ROLE_ADMIN / ROLE_IMAGE_ADMIN, enforced again server-side */}
                    {isAdmin(userInfo) ? (
                        <>
                            <Route path="/admin" element={<AdminHome setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/upload" element={<Upload setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/batches" element={<BatchStatus setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/search-criteria" element={<SearchCriteriaAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/index-search" element={<IndexSearch setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/tags" element={<TagsAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/storage-locations" element={<StorageLocationsAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/licences" element={<LicencesAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/duplicates" element={<DuplicatesAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/settings" element={<SettingsAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/analytics" element={<AnalyticsAdmin setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/tools" element={<Tools setBreadcrumbs={setCrumbs}/>}/>
                            <Route path="/admin/swagger" element={<SwaggerView setBreadcrumbs={setCrumbs}/>}/>
                        </>
                    ) : (
                        <Route
                            path="/admin/*"
                            element={
                                <div style={{display: 'flex', height: '50vh', justifyContent: 'center', alignItems: 'center'}} data-testid="admin-gate">
                                    {userInfo?.authenticated ? <div>Insufficient permissions.</div> : <div>Admin login required</div>}
                                </div>
                            }
                        />
                    )}

                    <Route path="*" element={<NotFound/>}/>
                </Routes>

                <div className="mt-4"/>

                <Footer isLoggedIn={userInfo?.authenticated} logoutFn={handleLogoutWrapper} loginFn={handleLoginWrapper} footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML}/>
            </UserContext.Provider>
        </main>
    );
}
