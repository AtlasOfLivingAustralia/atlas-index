/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { NuqsAdapter } from 'nuqs/adapters/react-router';
import messages_en from "./translations/en.json";
import {IntlProvider} from "react-intl";
import FontFaceObserver from 'fontfaceobserver'

import "@fontsource/roboto";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

// to make sure the fonts are loaded before rendering
const robotoRegular = new FontFaceObserver('Roboto', { weight: 400 });
const roboto500 = new FontFaceObserver('Roboto', { weight: 500 });
const roboto700 = new FontFaceObserver('Roboto', { weight: 700 });

Promise.all([robotoRegular.load(), roboto500.load(), roboto700.load()]).then(() => {
    const root = ReactDOM.createRoot(
        document.getElementById('root') as HTMLElement
    );
    root.render(
        <React.StrictMode>
            <NuqsAdapter>
                <Router>
                    <IntlProvider messages={messages_en} locale="en" defaultLocale="en" onError={() => {
                    }}>
                        <App/>
                    </IntlProvider>
                </Router>
            </NuqsAdapter>
        </React.StrictMode>
    );
})
