/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Minimal Jest-only replacement for `react-intl`.
//
// The real `react-intl` package is published as ESM and pulls in a chain of
// other ESM-only packages (`@formatjs/*`, `intl-messageformat`, ...), which
// Jest's CommonJS/Babel pipeline cannot parse out of the box. Rather than
// widening `transformIgnorePatterns` to cover that whole dependency tree,
// this file stands in for the handful of APIs the dashboard-ui source
// actually uses, rendering the `id` (or `defaultMessage`, when supplied) as
// plain text so assertions can target the same content a user would see.
import * as React from 'react';

type FormattedMessageProps = {
    id?: string;
    defaultMessage?: string;
};

export const FormattedMessage = ({ id, defaultMessage }: FormattedMessageProps) => {
    return <>{defaultMessage ?? id ?? ''}</>;
};

export const useIntl = () => ({
    formatMessage: ({ id, defaultMessage }: FormattedMessageProps) => defaultMessage ?? id ?? '',
});

export const IntlProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
