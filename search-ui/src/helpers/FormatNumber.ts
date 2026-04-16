/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

function formatNumber(num: number, locale?: string): string {
    const detectedLocale = locale ?? navigator.language ?? 'en';
    return new Intl.NumberFormat(detectedLocale).format(num);
}

export default formatNumber;

