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

const isLoggedInInitial = document.cookie.includes(import.meta.env.VITE_AUTH_COOKIE);

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);

    useEffect(() => {
        // load the common CSS used by both the header and footer
        fetch(import.meta.env.VITE_COMMON_CSS).then((response) => {
            if (response.ok) {
                response.text().then((text) => {
                    const style = document.createElement('style');
                    style.innerHTML = text;
                    document.head.appendChild(style);
                });
            }
        });
    }, []);

    // when receiving a login URL, handle the login by setting the auth cookie only
    function handleLogin() {
        if (import.meta.env.MODE === 'production') {
            // do login that is suitable for an application that no authentication requirement
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

            <div className="mt-4"/>

            <Dashboard/>

            <div className="mt-4"/>

            {import.meta.env.VITE_COMMON_FOOTER_HTML &&
                <Footer isLoggedIn={isLoggedIn} logoutFn={handleLogout} loginFn={handleLogin}/>
            }
        </main>
    );
}

