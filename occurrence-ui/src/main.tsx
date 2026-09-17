/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider } from '@ala/common-ui';
import {BrowserRouter as Router} from 'react-router-dom';
import App from './App';
import messages_en from './translations/en.json';
import { NuqsAdapter } from 'nuqs/adapters/react-router';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <NuqsAdapter>
            <Router>
                <I18nProvider messages={messages_en}>
                    <App />
                </I18nProvider>
            </Router>
        </NuqsAdapter>
    </React.StrictMode>
);
