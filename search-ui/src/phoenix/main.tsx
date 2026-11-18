/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Separate entry so phoenix.css (which contains Bootstrap) never loads alongside ala-combined.css.
import '@ala/ui/theme.css';
import './phoenix.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {NuqsAdapter} from 'nuqs/adapters/react-router';
import {I18nProvider} from '@ala/common-ui';
import messages_en from '../translations/en.json';
import PhoenixApp from './PhoenixApp';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <NuqsAdapter>
            <BrowserRouter basename="/phoenix">
                <I18nProvider messages={messages_en}>
                    <PhoenixApp/>
                </I18nProvider>
            </BrowserRouter>
        </NuqsAdapter>
    </React.StrictMode>
);
