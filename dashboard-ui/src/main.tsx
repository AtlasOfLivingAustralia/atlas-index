import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import messages_en from "./translations/en.json";
import {IntlProvider} from "react-intl";
import {HashRouter as Router} from 'react-router-dom';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);


root.render(
    <React.StrictMode>
        <Router>

            <IntlProvider messages={messages_en} locale="en" defaultLocale="en" onError={() => {
            }}>
                <App/>
            </IntlProvider>
        </Router>
    </React.StrictMode>
);
