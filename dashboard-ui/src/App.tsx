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
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight'
import {useEffect, useState} from "react";
import './index.css';

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    useEffect(() => {
        handleLogin();

        checkForAuthCookie();
    }, []);

    // when receiving a login URL, handle the login by setting the auth cookie only
    function handleLogin() {
        // set the auth cookie to "loggedIn" when the login URL is received
        const url = new URL(window.location.href);
        const login = url.searchParams.get("login");
        if (login === "true") {
            document.cookie = `${import.meta.env.VITE_AUTH_COOKIE}loggedIn; path=/; domain=${import.meta.env.VITE_AUTH_COOKIE_DOMAIN}`;
            window.location.href = import.meta.env.VITE_DASHBOARD_URL;
        }
    }

    // only basic check is required for dashboard as it has no features for a logged in user
    function checkForAuthCookie() {
        const cookies = document.cookie.split(';');
        const authCookie = cookies.find(cookie => cookie.trim().startsWith(import.meta.env.VITE_AUTH_COOKIE));
        setIsLoggedIn(!!authCookie);
    }

    return (
            <main>
                <Header isLoggedIn={isLoggedIn}/>

                <section id="breadcrumb">
                    <div className="container-fluid">
                        <div className="row">
                            <nav aria-label="Breadcrumb" role="navigation">
                                <ol className="breadcrumb-list breadcrumb">
                                    <li className="breadcrumb-item">
                                        <a href={import.meta.env.VITE_HOME_URL}>Home</a>
                                    </li>
                                    <li className="breadcrumb-item"><FontAwesomeIcon icon={faChevronRight} className={"breadcrumb-icon"}/>Dashboard</li>
                                </ol>
                            </nav>
                        </div>
                    </div>
                </section>

                <div className="mt-4"/>

                <Dashboard />

                <div className="mt-4"/>

                <Footer isLoggedIn={isLoggedIn}/>
            </main>
    );
}

