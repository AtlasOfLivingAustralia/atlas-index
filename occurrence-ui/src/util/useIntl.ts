/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { IntlShape, useIntl as useReactIntl } from 'react-intl';

/**
 * Drop-in replacement for react-intl's `useIntl()` primarily to pass ignoreTag: true
 */
export function useIntl(): IntlShape {
    const intl = useReactIntl();

    return {
        ...intl,
        formatMessage: ((descriptor, values, opts) =>
            intl.formatMessage(descriptor, values, { ignoreTag: true, ...opts })) as typeof intl.formatMessage,
    };
}

