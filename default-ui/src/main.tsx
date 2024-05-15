import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {HashRouter as Router} from 'react-router-dom';
import messages_en from "./translations/en.json";
import {IntlProvider} from "react-intl";
import { AuthProvider } from "react-oidc-context";
import {WebStorageStateStore} from "oidc-client-ts";

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

const oidcConfig = {
    authority: import.meta.env.VITE_OIDC_AUTH_SERVER,
    client_id:  import.meta.env.VITE_OIDC_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    scope: import.meta.env.VITE_OIDC_SCOPE,
    post_logout_redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    onSigninCallback: () => {
        console.log("onSigninCallback");
        const { search } = window.location;
        if (search.includes('code=') && search.includes('state=')) {
            const params = new URLSearchParams(window.location.search);
            params.delete('code');
            params.delete('state');
            params.delete('client_id');
            let paramStr = (params.toString() ? "?" : "") + params.toString()
            window.history.replaceState(
                null,
                '',
                `${window.location.origin}${window.location.pathname}${paramStr}`
            );
        }
    },
    onSignoutCallback: () => {
        console.log("onSignoutCallback");
    }

};

root.render(
        <React.StrictMode>
            <Router>
                <AuthProvider {...oidcConfig}>
                    <IntlProvider messages={messages_en} locale="en" defaultLocale="en" onError={() => {}}>
                        {/*<Notifications position="top-center" />*/}
                        <App />
                    </IntlProvider>
                </AuthProvider>
            </Router>
        </React.StrictMode>
);
