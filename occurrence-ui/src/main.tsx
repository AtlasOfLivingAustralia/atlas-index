/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import {IntlProvider} from 'react-intl';
import {BrowserRouter as Router} from 'react-router-dom';
import App from './App';
import messages_en from './translations/en.json';
import { NuqsAdapter } from 'nuqs/adapters/react-router';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <NuqsAdapter>
            <Router>
                <IntlProvider messages={messages_en} locale='en' defaultLocale='en'>
                    <App />
                </IntlProvider>
            </Router>
        </NuqsAdapter>
    </React.StrictMode>
);
