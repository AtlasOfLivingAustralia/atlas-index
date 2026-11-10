/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import formatLicence, {type Licence} from './FormatLicence';

const licences: Licence[] = [
    {url: 'https://creativecommons.org/licenses/by/4.0/', acronym: 'CC BY 4.0'},
    {url: 'https://en.wikipedia.org/wiki/All_rights_reserved', acronym: 'ALL-RIGHTS-RESERVED'}
];

describe('formatLicence', () => {
    it('uses the registry acronym for exact URL matches, including non-CC licences', () => {
        for (const licence of licences) {
            expect(formatLicence(licence.url, licences)).toBe(licence.acronym);
        }
    });

    it.each([
        ['http://creativecommons.org/licenses/by/4.0/', 'https://creativecommons.org/licenses/by/4.0/'],
        ['https://creativecommons.org/licenses/by/4.0/', 'http://creativecommons.org/licenses/by/4.0/'],
        ['https://creativecommons.org/licenses/by/4.0', 'https://creativecommons.org/licenses/by/4.0/'],
        ['https://creativecommons.org/licenses/by/4.0/', 'https://creativecommons.org/licenses/by/4.0'],
        ['http://creativecommons.org/licenses/by/4.0', 'https://creativecommons.org/licenses/by/4.0/']
    ])('matches %s against registry URL %s', (value, url) => {
        expect(formatLicence(value, [{url, acronym: 'CC BY 4.0'}])).toBe('CC BY 4.0');
    });

    it('preserves unmatched values and values awaiting the registry', () => {
        const value = 'http://creativecommons.org/licenses/by/5.0/';
        expect(formatLicence(value, licences)).toBe(value);
        expect(formatLicence(licences[0].url, [])).toBe(licences[0].url);
    });
});

describe('loadLicences', () => {
    const apiUrl = 'https://images.test.ala.org.au/ws';
    const originalFetch = globalThis.fetch;
    let loadLicences: typeof import('./FormatLicence').loadLicences;
    let fetchMock: jest.Mock;

    beforeEach(async () => {
        jest.resetModules();
        sessionStorage.clear();
        ({loadLicences} = await import('./FormatLicence'));
        fetchMock = jest.fn().mockResolvedValue({ok: true, json: async () => licences});
        globalThis.fetch = fetchMock;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        sessionStorage.clear();
        globalThis.fetch = originalFetch;
    });

    it('deduplicates requests and reuses the session cache after a page reload', async () => {
        const first = loadLicences(apiUrl);
        expect(loadLicences(apiUrl)).toBe(first);
        await expect(first).resolves.toEqual(licences);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/licence`);
        jest.resetModules();
        const reloadFetch = jest.fn();
        globalThis.fetch = reloadFetch;
        ({loadLicences} = await import('./FormatLicence'));
        await expect(loadLicences(apiUrl)).resolves.toEqual(licences);
        expect(reloadFetch).not.toHaveBeenCalled();
    });

    it('keeps different API bases separate', async () => {
        await loadLicences(apiUrl);
        await loadLicences('https://images.ala.org.au/ws');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('refetches a corrupt session cache', async () => {
        sessionStorage.setItem(`image-licences:${apiUrl}/licence`, 'invalid JSON');
        await expect(loadLicences(apiUrl)).resolves.toEqual(licences);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['HTTP error', {ok: false, status: 503}],
        ['invalid registry', {ok: true, json: async () => [{url: 'https://example.org/'}]}]
    ])('retries after %s', async (_description, response) => {
        fetchMock.mockResolvedValueOnce(response);
        await expect(loadLicences(apiUrl)).rejects.toThrow();
        expect(sessionStorage.length).toBe(0);
        await expect(loadLicences(apiUrl)).resolves.toEqual(licences);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries after a network failure', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Network failure'));
        await expect(loadLicences(apiUrl)).rejects.toThrow('Network failure');
        await expect(loadLicences(apiUrl)).resolves.toEqual(licences);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('still returns licences when session storage is unavailable', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
        await expect(loadLicences(apiUrl)).resolves.toEqual(licences);
    });
});
