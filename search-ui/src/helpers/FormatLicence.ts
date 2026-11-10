/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface Licence {
    url: string;
    acronym: string;
}

const licenceRequests = new Map<string, Promise<Licence[]>>();

function isLicenceList(data: unknown): data is Licence[] {
    return Array.isArray(data) && data.every(licence =>
        licence && typeof licence.url === 'string' && licence.url.length > 0 &&
        typeof licence.acronym === 'string' && licence.acronym.length > 0
    );
}

export function loadLicences(apiUrl: string): Promise<Licence[]> {
    const url = `${apiUrl}/licence`;
    const cacheKey = `image-licences:${url}`;
    let request = licenceRequests.get(url);
    if (!request) {
        try {
            const cached: unknown = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
            if (isLicenceList(cached)) return Promise.resolve(cached);
        } catch {}

        request = (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Licence request failed: ${response.status}`);
                const data: unknown = await response.json();
                if (!isLicenceList(data)) throw new Error('Invalid licence response');
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                } catch {}
                return data;
            } finally {
                licenceRequests.delete(url);
            }
        })();
        licenceRequests.set(url, request);
    }
    return request;
}

function formatLicence(value: string, licences: Licence[]): string {
    const normaliseUrl = (url: string) => url.replace(/^http:\/\//, 'https://').replace(/\/$/, '');
    const url = normaliseUrl(value);
    return licences.find(licence => normaliseUrl(licence.url) === url)?.acronym ?? value;
}

export default formatLicence;
