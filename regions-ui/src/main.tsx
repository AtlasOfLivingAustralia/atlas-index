/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import messages_en from "./translations/en.json";
import {IntlProvider} from "react-intl";
import { BrowserRouter as Router } from 'react-router-dom';

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
