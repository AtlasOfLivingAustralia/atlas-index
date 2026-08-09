/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('@ala/common-ui', () => ({
    Pagination: (props: any) => (
        <div data-testid="pagination" data-page={props.page} data-max={props.maxResults} />
    ),
}));

describe('Home', () => {
    const setBreadcrumbs = jest.fn();

    beforeEach(() => {
        mockNavigate.mockClear();
        setBreadcrumbs.mockClear();
        (globalThis as any).fetch = jest.fn();
    });

    function renderHome() {
        return render(
            <MemoryRouter>
                <Home setBreadcrumbs={setBreadcrumbs} isMobile={false} breadcrumb={<div>crumb</div>} />
            </MemoryRouter>
        );
    }

    it('sets breadcrumbs on mount', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            headers: { get: () => '0' },
            json: () => Promise.resolve([]),
        });

        const { container } = renderHome();

        expect(setBreadcrumbs).toHaveBeenCalledWith([
            { title: 'Home', href: 'https://ala.org.au' },
            { title: 'ALA DOI Repository', href: '' },
        ]);

        // Let the mocked fetch() promise chain resolve inside act() so the
        // resulting state updates don't leak past this test.
        await waitFor(() => expect(container.querySelector('.placeholder-glow')).not.toBeInTheDocument());
    });

    it('shows a loading placeholder before data resolves', () => {
        (globalThis.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves

        const { container } = renderHome();

        expect(container.querySelector('.placeholder-glow')).toBeInTheDocument();
    });

    it('renders recent DOIs after a successful fetch', async () => {
        const data = [
            {
                uuid: 'uuid-1',
                title: 'Occurrence download 1',
                doi: '10.1/abc',
                description: 'desc 1',
                dateCreated: '2025-01-01T00:00:00Z',
                applicationMetadata: { recordCount: 100, datasets: [{ name: 'ds1', licence: 'CC BY 4.0', count: 100 }] },
            },
        ];
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            headers: { get: () => '1' },
            json: () => Promise.resolve(data),
        });

        renderHome();

        await waitFor(() => expect(screen.getByText('Occurrence download 1')).toBeInTheDocument());
        expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && !!el.textContent?.includes('10.1/abc'))).toBeInTheDocument();
    });

    it('handles a failed fetch gracefully, showing zero results', async () => {
        (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('network error'));

        renderHome();

        await waitFor(() => expect(screen.getByTestId('pagination')).toHaveAttribute('data-max', '0'));
    });

    it('navigates to /myDownloads when the "My Downloads" button is clicked', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            headers: { get: () => '0' },
            json: () => Promise.resolve([]),
        });

        renderHome();

        await waitFor(() => screen.getByText('My Downloads'));
        screen.getByText('My Downloads').click();

        expect(mockNavigate).toHaveBeenCalledWith('/myDownloads');
    });

    it('navigates to /doi/:uuid when a recent DOI row is clicked', async () => {
        const data = [
            {
                uuid: 'uuid-42',
                title: 'Row title',
                doi: '10.1/row',
                description: 'row desc',
                dateCreated: '2025-01-01T00:00:00Z',
                applicationMetadata: { recordCount: 5, datasets: [] },
            },
        ];
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            headers: { get: () => '1' },
            json: () => Promise.resolve(data),
        });

        renderHome();

        await waitFor(() => screen.getByText('Row title'));
        screen.getByText('Row title').closest('tr')!.click();

        expect(mockNavigate).toHaveBeenCalledWith('/doi/uuid-42');
    });
});
