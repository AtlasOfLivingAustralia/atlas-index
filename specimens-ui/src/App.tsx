/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'bootstrap/dist/css/bootstrap.css';
import Browse from "./views/Browse.tsx";
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fontsource/roboto";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import Header from "./components/common-ui/header.tsx";
import Footer from "./components/common-ui/footer.tsx";
import FontAwesomeIcon from './components/common-ui/fontAwesomeIconLite.tsx'
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'
import {useEffect, useState} from "react";
import './index.css';
import {Link, Route, Routes} from "react-router-dom";
import {Breadcrumb} from "./api/sources/model.ts";
import buildInfo from './buildInfo.json';
import Banner from "./components/common-ui/banner.tsx";
import Home from "./views/Home.tsx";

const isLoggedInInitial = document.cookie.includes(import.meta.env.VITE_AUTH_COOKIE);

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{
        title: "Home",
        href: import.meta.env.VITE_HOME_URL
    }]);

    useEffect(() => {
        // Add build info to head meta tags
        const meta = document.createElement('meta');
        meta.name = 'buildInfo';
        meta.content = JSON.stringify(buildInfo);
        document.head.appendChild(meta);

        // Add env value to head meta tags
        const envMeta = document.createElement('meta');
        envMeta.name = 'env';
        envMeta.content = JSON.stringify({ env: import.meta.env.VITE_ENV });
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

    if (!cssLoaded) {
        return <></>
    }

    return (
        <main>
            {import.meta.env.VITE_COMMON_HEADER_HTML &&
                <Header isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }

            <section id="breadcrumb">
                <div className="container-fluid">
                    <div className="row">
                        <nav aria-label="Breadcrumb" role="navigation">
                            <ol className="breadcrumb-list breadcrumb">
                                {breadcrumbItems}
                            </ol>
                        </nav>
                    </div>
                </div>
            </section>

            <Banner/>

            <div className="mt-4"/>

            <Routes>
                <Route path="/" element={<Home setBreadcrumbs={setBreadcrumbs}/>}/>
                <Route path="/browse/:entityUid?" element={<Browse setBreadcrumbs={setBreadcrumbs}/>}/>
            </Routes>

            <div className="mt-4"/>

            {import.meta.env.VITE_COMMON_FOOTER_HTML &&
                <Footer isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }
        </main>
    );
}

