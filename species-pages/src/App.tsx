/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from 'react';
import {Link, Route, Routes} from 'react-router-dom';
import {Breadcrumb} from './api/sources/model';

import Species from './views/Species';

import 'bootstrap/dist/css/bootstrap.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import FontAwesomeIcon from './components/common-ui/fontAwesomeIconLite.tsx'
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'
import buildInfo from './buildInfo.json';
import Search from "./views/Search.tsx";
import Header from "./components/common-ui/header.tsx";
import Banner from "./components/common-ui/banner.tsx";
import Footer from "./components/common-ui/footer.tsx";
import NotFound from "./components/common-ui/notFound.tsx";

const isLoggedInInitial = document.cookie.includes(import.meta.env.VITE_AUTH_COOKIE);

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Search', href: '/'}
    ]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Add build info to head meta tags
        const meta = document.createElement('meta');
        meta.name = 'buildInfo';
        meta.content = JSON.stringify(buildInfo);
        document.head.appendChild(meta);

        // Add env value to head meta tags
        const envMeta = document.createElement('meta');
        envMeta.name = 'env';
        envMeta.content = JSON.stringify({env: import.meta.env.VITE_ENV});
        document.head.appendChild(envMeta);

        if (import.meta.env.VITE_COMMON_CSS) {
            // load the common CSS used by both the header and footer
            fetch(import.meta.env.VITE_COMMON_CSS).then((response) => {
                if (response.ok) {
                    response.text().then((text) => {
                        const style = document.createElement('style');
                        style.innerHTML = text;
                        document.head.appendChild(style);
                    });
                }
            }).finally(() => {
                // set css loaded to true even if the fetch fails
                setCssLoaded(true);
            });
        } else {
            setCssLoaded(true);
        }

        if (import.meta.env.VITE_COMMON_JS) {
            // load the common js
            const script = document.createElement('script');
            script.src = import.meta.env.VITE_COMMON_JS;
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    const breadcrumbItems = breadcrumbs.map((breadcrumb: Breadcrumb, index) => {
        return (
            <li className="breadcrumb-item" key={index}>
                {index > 0 && <FontAwesomeIcon icon={faChevronRight} className={"breadcrumb-icon"}/>}
                {index < breadcrumbs.length - 1 ? (
                    <Link to={breadcrumb.href ? breadcrumb.href : '#'}>{breadcrumb.title}</Link>
                ) : (
                    <>
                        {breadcrumb.title}
                    </>
                )
                }
            </li>);
    });

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
        return <></>
    }

    return (
        <>
            {import.meta.env.VITE_COMMON_HEADER_HTML &&
                <Header isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }

            <Banner/>

            {breadcrumbItems.length > 0 && !isMobile && // Some pages don't have breadcrumbs or include them in the page
                <section id="breadcrumb" style={{width: "fit-content", zIndex: 1, position: "relative", backgroundColor: "transparent", border: "none"}}>
                    <div>
                        <nav aria-label="Breadcrumb" role="navigation">
                            <ol className="breadcrumb-list breadcrumb">
                                {breadcrumbItems}
                            </ol>
                        </nav>
                    </div>
                </section>
            }

            <Routes>
                <Route
                    path="/species/*"
                    element={
                        <Species
                            setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                        />
                    }
                />
                <Route
                    path="/"
                    element={
                        <Search
                            setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                        />
                    }
                />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <div style={{height: "60px"}}/>

            {import.meta.env.VITE_COMMON_FOOTER_HTML &&
                <Footer isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }
        </>
    );
};

export default App;
