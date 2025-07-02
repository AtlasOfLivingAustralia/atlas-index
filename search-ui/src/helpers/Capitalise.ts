/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

function capitalizeFirstLetter(string: string) {
    return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
}

export default capitalizeFirstLetter;
