/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TreeItem from './tree.tsx';
import { TreeItemObj } from '../../api/sources/model.ts';

describe('TreeItem', () => {
    const list: TreeItemObj[] = [{ fq: 'kingdom:Animalia', count: 12345, label: 'Animalia' }];

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders a formatted count and label for each row', () => {
        render(<TreeItem level={0} list={list} />);
        expect(screen.getByText(/Animalia/)).toBeInTheDocument();
        expect(screen.getByText(/12,345/)).toBeInTheDocument();
    });

    it('shows "-" for a row at the deepest level of the kingdom tree instead of an expand toggle', () => {
        render(<TreeItem level={7} list={list} />);
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('fetches child facet data and renders the resulting sub-tree when expanded', async () => {
        const mockJson = [
            {
                fieldResult: [{ fq: 'phylum:Chordata', count: 99, label: 'Chordata' }],
            },
        ];
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve(mockJson),
        }) as any;

        render(<TreeItem level={0} list={list} />);

        fireEvent.click(screen.getByText(/Animalia/).parentElement!.querySelector('div > div')!);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('kingdom:Animalia');
        expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('facets=phylum');

        await waitFor(() => expect(screen.getByText(/Chordata/)).toBeInTheDocument());
    });

    it('renders "-" for an expanded row whose facet response has no children', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve([{}]),
        }) as any;

        render(<TreeItem level={0} list={list} />);

        const toggle = screen.getByText(/Animalia/).closest('td')!.querySelector('div > div')!;
        fireEvent.click(toggle);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        await waitFor(() => {
            const dashes = screen.getAllByText('-');
            expect(dashes.length).toBeGreaterThan(0);
        });
    });
});
