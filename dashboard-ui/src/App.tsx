/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'bootstrap/dist/css/bootstrap.css';
import Dashboard from "./views/Dashboard.tsx"
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fontsource/roboto";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import Header from "./components/common-ui/header.tsx";
import Footer from "./components/common-ui/footer.tsx";
import FontAwesomeIcon from './components/icon/fontAwesomeIconLite'
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'
import {useEffect, useState} from "react";
import './index.css';
import buildInfo from './buildInfo.json';

const isLoggedInInitial = document.cookie.includes(import.meta.env.VITE_AUTH_COOKIE);

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
    const [cssLoaded, setCssLoaded] = useState<boolean>(false);

    useEffect(() => {
        // Add build info to head meta tags
        const meta = document.createElement('meta');
        meta.name = 'buildInfo';
        meta.content = JSON.stringify(buildInfo);
        document.head.appendChild(meta);

        if (import.meta.env.VITE_COMMON_CSS) {
            // load the common CSS used by both the header and footer
            fetch(import.meta.env.VITE_COMMON_CSS).then((response) => {
                if (response.ok) {
                    response.text().then((text) => {
                        const style = document.createElement('style');
                        style.innerHTML = text;
                        document.head.appendChild(style);
                        setCssLoaded(true);
                    });
                }
            });
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

    return (
        <main>
            {import.meta.env.VITE_COMMON_HEADER_HTML &&
                <Header isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }

            {cssLoaded &&
                <section id="breadcrumb">
                    <div className="container-fluid">
                        <div className="row">
                            <nav aria-label="Breadcrumb" role="navigation">
                                <ol className="breadcrumb-list breadcrumb">
                                    <li className="breadcrumb-item">
                                        <a href={import.meta.env.VITE_HOME_URL}>Home</a>
                                    </li>
                                    <li className="breadcrumb-item"><FontAwesomeIcon icon={faChevronRight}
                                                                                     className={"breadcrumb-icon"}/>Dashboard
                                    </li>
                                </ol>
                            </nav>
                        </div>
                    </div>
                </section>
            }

            <div className="mt-4"/>

            <Dashboard/>

            <div className="mt-4"/>

            {import.meta.env.VITE_COMMON_FOOTER_HTML &&
                <Footer isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }
        </main>
    );
}

