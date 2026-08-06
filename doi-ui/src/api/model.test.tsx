/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { DoiData } from './model';

describe('DoiData type', () => {
    it('accepts a minimal valid object', () => {
        const minimal: DoiData = {
            title: 'A title',
            description: 'A description',
            uuid: 'uuid-1',
            doi: '10.1/abc',
        };

        expect(minimal.title).toBe('A title');
        expect(minimal.authorisedRoles).toBeUndefined();
    });

    it('accepts a fully populated object', () => {
        const full: DoiData = {
            title: 'A title',
            description: 'A description',
            uuid: 'uuid-2',
            authorisedRoles: ['ROLE_ADMIN'],
            filename: 'file.zip',
            providerMetadata: { title: 'Provider title' },
            dateCreated: '2025-01-01T00:00:00Z',
            doi: '10.1/xyz',
            active: true,
            displayTemplate: true,
            applicationMetadata: {
                recordCount: 10,
                searchUrl: 'https://example.com/search',
                datasets: [{ name: 'ds1', licence: 'CC BY 4.0', count: 5 }],
            },
        };

        expect(full.applicationMetadata?.datasets).toHaveLength(1);
        expect(full.applicationMetadata?.datasets[0].name).toBe('ds1');
    });
});
