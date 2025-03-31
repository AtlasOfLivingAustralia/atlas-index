import { formatNumber } from './FormatNumber';

describe('formatNumber', () => {
    beforeAll(() => {
        Object.defineProperty(navigator, 'language', {
            value: 'en',
            configurable: true
        });
    });

    test('should return the number as is if it is not a number', () => {
        expect(formatNumber('abc')).toBe('abc');
    });

    test('should format numbers greater than 1,000,000 as millions', () => {
        expect(formatNumber(2500000)).toBe('2.5M');
    });

    test('should format numbers greater than 1,000,000,000 as billions', () => {
        expect(formatNumber(2500000000)).toBe('2.5B');
    });

    test('should format numbers with two decimal places', () => {
        expect(formatNumber(1234567)).toBe('1.23M');
    });

    test('should format small numbers correctly', () => {
        expect(formatNumber(123)).toBe('123');
        expect(formatNumber(12345)).toBe('12,345');
        expect(formatNumber(123456)).toBe('123,456');
    });
});
