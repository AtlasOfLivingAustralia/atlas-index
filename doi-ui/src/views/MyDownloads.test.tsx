/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MyDownloads from './MyDownloads';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

const mockHandleLogin = jest.fn();
let mockUserInfo: any = null;
jest.mock('@ala/common-ui', () => ({
    useUser: () => ({ userInfo: mockUserInfo }),
    handleLogin: (...args: any[]) => mockHandleLogin(...args),
    Pagination: (props: any) => (
        <div data-testid="pagination" data-page={props.page} data-max={props.maxResults} />
    ),
}));

describe('MyDownloads', () => {
    const setBreadcrumbs = jest.fn();

    beforeEach(() => {
        mockNavigate.mockClear();
        mockHandleLogin.mockClear();
        setBreadcrumbs.mockClear();
        mockUserInfo = null;
        (globalThis as any).fetch = jest.fn();
    });

    function renderMyDownloads() {
        return render(
            <MemoryRouter>
                <MyDownloads setBreadcrumbs={setBreadcrumbs} isMobile={false} breadcrumb={<div>crumb</div>} />
            </MemoryRouter>
        );
    }

    it('does not fetch data while userInfo is still unknown (null)', () => {
        renderMyDownloads();

        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(setBreadcrumbs).not.toHaveBeenCalled();
    });

    it('redirects to login when the user is not authenticated', () => {
        mockUserInfo = { authenticated: false };

        renderMyDownloads();

        expect(mockHandleLogin).toHaveBeenCalledWith('http://localhost:8081');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('fetches downloads and DOIs, and sets breadcrumbs, for an authenticated user', async () => {
        mockUserInfo = { authenticated: true, userId: 'user-1', accessToken: 'tok' };
        (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
            if (String(url).includes('/occurrences/offline/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ headers: { get: () => '0' }, json: () => Promise.resolve([]) });
        });

        renderMyDownloads();

        await waitFor(() => expect(setBreadcrumbs).toHaveBeenCalledWith([
            { title: 'Home', href: 'https://ala.org.au' },
            { title: 'ALA DOI Repository', href: '/' },
            { title: 'My Downloads', href: '' },
        ]));
        expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('shows the empty state message when there are no downloads', async () => {
        mockUserInfo = { authenticated: true, userId: 'user-1', accessToken: 'tok' };
        (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
            if (String(url).includes('/occurrences/offline/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ headers: { get: () => '0' }, json: () => Promise.resolve([]) });
        });

        renderMyDownloads();

        await waitFor(() => expect(screen.getByText(/You don.t have any DOI downloads yet/)).toBeInTheDocument());
    });

    it('renders active downloads table with a cancel button', async () => {
        mockUserInfo = { authenticated: true, userId: 'user-1', accessToken: 'tok' };
        const activeDownloads = {
            'user@example.com': [
                { status: 'running', totalRecords: 100, records: 50, cancelUrl: 'https://example.com/cancel' },
            ],
        };
        (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
            if (String(url).includes('/occurrences/offline/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(activeDownloads) });
            }
            return Promise.resolve({ headers: { get: () => '0' }, json: () => Promise.resolve([]) });
        });

        renderMyDownloads();

        await waitFor(() => expect(screen.getByText('user@example.com')).toBeInTheDocument());
        expect(screen.getByText('running')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders previous downloads and navigates to the DOI page when a row is clicked on mobile', async () => {
        mockUserInfo = { authenticated: true, userId: 'user-1', accessToken: 'tok' };
        const recent = [
            {
                uuid: 'uuid-1',
                doi: '10.1/abc',
                title: 'My download',
                description: 'desc',
                dateCreated: '2025-01-01T00:00:00Z',
                applicationMetadata: { recordCount: 10, datasets: [] },
            },
        ];
        (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
            if (String(url).includes('/occurrences/offline/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ headers: { get: () => '1' }, json: () => Promise.resolve(recent) });
        });

        render(
            <MemoryRouter>
                <MyDownloads setBreadcrumbs={setBreadcrumbs} isMobile={true} breadcrumb={<div>crumb</div>} />
            </MemoryRouter>
        );

        await waitFor(() => screen.getByText('My download'));
        screen.getByText('My download').closest('tr')!.click();

        expect(mockNavigate).toHaveBeenCalledWith('/doi/uuid-1');
    });

    it('opens the DOI modal on desktop when a previous download row is clicked', async () => {
        mockUserInfo = { authenticated: true, userId: 'user-1', accessToken: 'tok' };
        const recent = [
            {
                uuid: 'uuid-2',
                doi: '10.1/xyz',
                title: 'Desktop download',
                description: 'desc',
                dateCreated: '2025-01-01T00:00:00Z',
                licence: ['CC BY 4.0'],
                applicationMetadata: { recordCount: 10, datasets: [] },
            },
        ];
        (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
            if (String(url).includes('/occurrences/offline/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            if (String(url).includes('/doi/10.1/xyz')) {
                return Promise.resolve({ status: 200, json: () => Promise.resolve(recent[0]) });
            }
            return Promise.resolve({ headers: { get: () => '1' }, json: () => Promise.resolve(recent) });
        });

        renderMyDownloads();

        await waitFor(() => screen.getByText('Desktop download'));

        // Wrap the raw DOM click in act() so the fetch it triggers, and the
        // resulting setSelectedDoi/setShowDoiModal state updates, resolve
        // inside act() instead of leaking past this test.
        await act(async () => {
            screen.getByText('Desktop download').closest('tr')!.click();
        });

        // Modal renders an embedded Doi component; navigate should not be called on desktop
        expect(mockNavigate).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByLabelText('Close')).toBeInTheDocument());
    });
});
