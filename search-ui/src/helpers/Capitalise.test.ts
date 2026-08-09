/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import capitalizeFirstLetter from './Capitalise';

describe('capitalizeFirstLetter', () => {
    it('capitalizes the first letter of a lowercase word', () => {
        expect(capitalizeFirstLetter('hello')).toBe('Hello');
    });

    it('leaves an already-capitalized word unchanged', () => {
        expect(capitalizeFirstLetter('Hello')).toBe('Hello');
    });

    it('returns an empty string for an empty input', () => {
        expect(capitalizeFirstLetter('')).toBe('');
    });

    it('handles a single character string', () => {
        expect(capitalizeFirstLetter('a')).toBe('A');
    });

    it('only capitalizes the first character, leaving the rest untouched', () => {
        expect(capitalizeFirstLetter('hELLO wORLD')).toBe('HELLO wORLD');
    });

    it('does not affect leading whitespace', () => {
        expect(capitalizeFirstLetter(' hello')).toBe(' hello');
    });

    it('capitalizes a string that starts with a number unchanged', () => {
        expect(capitalizeFirstLetter('1st')).toBe('1st');
    });
});
