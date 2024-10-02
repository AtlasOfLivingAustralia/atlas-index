import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {HashRouter as Router} from 'react-router-dom';
import messages_en from "./translations/en.json";
import {IntlProvider} from "react-intl";
import {AuthProvider} from "react-oidc-context";
import {WebStorageStateStore} from "oidc-client-ts";
import { MantineProvider } from '@mantine/core';
import { theme } from '@atlasoflivingaustralia/ala-mantine';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

const oidcConfig = {
    authority: import.meta.env.VITE_OIDC_AUTH_SERVER,
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    scope: import.meta.env.VITE_OIDC_SCOPE,
    post_logout_redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    userStore: new WebStorageStateStore({store: window.localStorage}),
    onSigninCallback: (user: any) => {
        // user.state.from is set when clicking the login button.
        // While it could route instead, the use of query parameters is not yet explored.
        window.location.href = `${window.location.origin}${user.state.from}`
    },
    onSignoutCallback: () => {
        console.log("onSignoutCallback");
    }

};

root.render(
    // TODO: react-leaflet does not handle strict mode
    <React.StrictMode>
        <Router>
            <AuthProvider {...oidcConfig}>
                <IntlProvider messages={messages_en} locale="en" defaultLocale="en" onError={() => {
                }}>
                    {/*<Notifications position="top-center" />*/}
                    <MantineProvider theme={theme}>
                        <App/>
                    </MantineProvider>
                </IntlProvider>
            </AuthProvider>
        </Router>
    </React.StrictMode>
);
