/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { formatNumber } from './FormatNumber.tsx';

describe('formatNumber', () => {
    it('returns the original value unchanged when it is not numeric', () => {
        expect(formatNumber('not-a-number')).toBe('not-a-number');
    });

    it('formats small numbers with thousands separators and no suffix', () => {
        expect(formatNumber(1234)).toBe('1,234');
    });

    it('formats zero', () => {
        expect(formatNumber(0)).toBe('0');
    });

    it('formats numbers just over one million with an "M" suffix', () => {
        expect(formatNumber(1500000)).toBe('1.5M');
    });

    it('formats numbers just over one billion with a "B" suffix', () => {
        expect(formatNumber(2500000000)).toBe('2.5B');
    });

    it('rounds to two decimal places', () => {
        expect(formatNumber(1234567)).toBe('1.23M');
    });

    it('does apply a suffix at exactly one million', () => {
        expect(formatNumber(1000000)).toBe('1M');
    });

    it('formats a value of exactly one billion using the "B" suffix', () => {
        // Because the 1B check is an `else if` following the 1M check, any
        // value over 1,000,000 (including 1,000,000,000) is formatted using
        // the "M" suffix — the "B" branch can never actually execute.
        expect(formatNumber(1000000000)).toBe('1B');
    });

    it('handles numeric strings', () => {
        expect(formatNumber('4200000')).toBe('4.2M');
    });
});
