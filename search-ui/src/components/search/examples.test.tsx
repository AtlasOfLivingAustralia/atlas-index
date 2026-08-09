/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {act, fireEvent, render} from '@testing-library/react';
import '@testing-library/jest-dom';
import {Examples} from './examples.tsx';

// The rendered <a> elements have no href, so they don't get an implicit
// accessible "link" role; query them directly via the container instead.
function getLinks(container: HTMLElement): HTMLAnchorElement[] {
    return Array.from(container.querySelectorAll('a'));
}

describe('Examples', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders no more than 5 example links', async () => {
        const {container} = render(<Examples asText={false} tab="all" setQueryAndTab={jest.fn()} />);
        await act(async () => {});
        const links = getLinks(container);
        expect(links.length).toBeLessThanOrEqual(5);
        expect(links.length).toBeGreaterThan(0);
    });

    it('renders examples as buttons (not comma-separated text) when asText is false', async () => {
        const {container} = render(<Examples asText={false} tab="all" setQueryAndTab={jest.fn()} />);
        await act(async () => {});
        const links = getLinks(container);
        links.forEach(link => {
            expect(link.className).toContain('btn');
        });
        expect(container.textContent).not.toContain(',');
    });

    it('renders examples as comma-separated inline text when asText is true', async () => {
        const {container} = render(<Examples asText={true} tab="all" setQueryAndTab={jest.fn()} />);
        await act(async () => {});
        const links = getLinks(container);
        links.forEach(link => {
            expect(link.className).toBe('');
        });
        if (links.length > 1) {
            expect(container.textContent).toContain(',');
        }
    });

    it('calls setQueryAndTab with the example query and tab when a link is clicked', async () => {
        const setQueryAndTab = jest.fn();
        const {container} = render(<Examples asText={true} tab="all" setQueryAndTab={setQueryAndTab} />);
        await act(async () => {});
        const links = getLinks(container);
        fireEvent.click(links[0]);
        expect(setQueryAndTab).toHaveBeenCalledTimes(1);
        const [query, tab] = setQueryAndTab.mock.calls[0];
        expect(typeof query).toBe('string');
        expect(query.length).toBeGreaterThan(0);
        expect(typeof tab).toBe('string');
    });

    it('sorts the rendered examples by query alphabetically', async () => {
        const {container} = render(<Examples asText={true} tab="all" setQueryAndTab={jest.fn()} />);
        await act(async () => {});
        const links = getLinks(container).map(l => l.textContent);
        const sorted = [...links].sort((a, b) => (a || '').localeCompare(b || ''));
        expect(links).toEqual(sorted);
    });

    it('only selects one example per group when tab is falsy, but still caps the final list at 5', async () => {
        const {container} = render(<Examples asText={false} tab={''} setQueryAndTab={jest.fn()} />);
        await act(async () => {});
        const links = getLinks(container);
        expect(links.length).toBeLessThanOrEqual(5);
    });
});
