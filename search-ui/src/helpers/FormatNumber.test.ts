/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import formatNumber from './FormatNumber';

describe('formatNumber', () => {
    it('uses the provided locale to format the number', () => {
        expect(formatNumber(1234567, 'en-US')).toBe('1,234,567');
    });

    it('formats using a different locale grouping style', () => {
        expect(formatNumber(1234567, 'de-DE')).toBe('1.234.567');
    });

    it('falls back to navigator.language when no locale is provided', () => {
        const spy = jest.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
        expect(formatNumber(1000)).toBe('1,000');
        spy.mockRestore();
    });

    it('formats zero correctly', () => {
        expect(formatNumber(0, 'en-US')).toBe('0');
    });

    it('formats negative numbers correctly', () => {
        expect(formatNumber(-42, 'en-US')).toBe('-42');
    });

    it('formats small numbers without grouping separators', () => {
        expect(formatNumber(999, 'en-US')).toBe('999');
    });
});
