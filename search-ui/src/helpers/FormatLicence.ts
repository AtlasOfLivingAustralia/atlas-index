/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

function formatLicence(value: string): string {
    const pattern = /^https?:\/\/(?:www\.)?creativecommons\.org\/(licenses\/(by|by-sa|by-nd|by-nc|by-nc-sa|by-nc-nd)|publicdomain\/(zero|mark))\/(\d+\.\d+)(?:\/[^?#]*)?(?:[?#].*)?$/i;
    
    const match = value.match(pattern);
    if (!match) return value;

    const [, , licenseType, pdType, version] = match;

    let name: string;
    if (licenseType) {
        name = `CC-${licenseType.toUpperCase()}`;
    } else if (pdType?.toLowerCase() === 'zero') {
        name = 'CC0';
    } else {
        name = 'Public Domain Mark';
    }

    return `${name} ${version}`;
}

export default formatLicence;
