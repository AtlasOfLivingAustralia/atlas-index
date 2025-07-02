// import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import messages_en from './translations/en.json';
import { IntlProvider } from 'react-intl';
import { AuthProvider } from 'react-oidc-context';
import React from 'react';
import { WebStorageStateStore, Log } from 'oidc-client-ts';

// Set log level (e.g., Debug, Info, Warn, Error, None)
Log.setLevel(Log.DEBUG);

// Optionally, set a custom logger (default logs to console)
Log.setLogger(console);

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

const oidcConfig = {
    authority: import.meta.env.VITE_OIDC_AUTH_SERVER,
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    scope: import.meta.env.VITE_OIDC_SCOPE,
    post_logout_redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URL,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    response_type: 'code',
    automaticSilentRenew: true,
    onSigninCallback: (user: any) => {
        // user.state.from is set when clicking the login button.
        // While it could route instead, the use of query parameters is not yet explored.
        console.log('onSigninCallback', window.location, user.state);
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    },
    onSignoutCallback: () => {
        console.log('onSignoutCallback');
    },
};

root.render(
    <React.StrictMode>
        <Router>
            <AuthProvider {...oidcConfig}>
                <IntlProvider
                    messages={messages_en}
                    locale="en"
                    defaultLocale="en"
                >
                    <App />
                </IntlProvider>
            </AuthProvider>
        </Router>
    </React.StrictMode>
);
