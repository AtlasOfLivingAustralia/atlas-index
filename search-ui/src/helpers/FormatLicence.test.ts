/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import formatLicence from './FormatLicence';

describe('formatLicence', () => {
    it.each([
        ['https://creativecommons.org/licenses/by/4.0/', 'CC-BY 4.0'],
        ['http://creativecommons.org/licenses/by-sa/3.0/au/', 'CC-BY-SA 3.0'],
        ['https://www.creativecommons.org/licenses/by-nc/4.0/deed.en?x=1', 'CC-BY-NC 4.0'],
        ['https://creativecommons.org/licenses/by-nd/4.0', 'CC-BY-ND 4.0'],
        ['https://creativecommons.org/licenses/by-nc-sa/4.0/', 'CC-BY-NC-SA 4.0'],
        ['https://creativecommons.org/licenses/by-nc-nd/4.0/', 'CC-BY-NC-ND 4.0'],
        ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0'],
        ['https://creativecommons.org/publicdomain/mark/1.0/', 'Public Domain Mark 1.0'],
        ['CC-BY 4.0 (Int)', 'CC-BY 4.0 (Int)'],
        ['https://example.org/licenses/by/4.0/', 'https://example.org/licenses/by/4.0/'],
        ['https://creativecommons.org.example.org/licenses/by/4.0/', 'https://creativecommons.org.example.org/licenses/by/4.0/'],
        ['https://creativecommons.org/licenses/unknown/4.0/', 'https://creativecommons.org/licenses/unknown/4.0/'],
        ['', '']
    ])('formats %s as %s', (value, expected) => {
        expect(formatLicence(value)).toBe(expected);
    });
});
