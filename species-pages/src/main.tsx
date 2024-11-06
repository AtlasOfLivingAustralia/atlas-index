import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {HashRouter as Router} from 'react-router-dom';
import { NuqsAdapter } from 'nuqs/adapters/react-router';
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

// TODO: When the UI is more or less finished, move this up to ala-mantine
// TODO: Make spacing variable, in case it is used for a component that automatically changes between mobile and desktop
// custom spacing
Object.assign(theme, {
    spacing: {
        px60: "60px",
        px40: "40px",
        px30: "30px",
        px15: "15px"
    }
});

root.render(
    // TODO: react-leaflet does not handle strict mode
    <React.StrictMode>
        <NuqsAdapter>
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
        </NuqsAdapter>
    </React.StrictMode>
);
