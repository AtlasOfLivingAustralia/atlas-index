/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Doi from './Doi';

const mockNavigate = jest.fn();
let mockPathname = '/doi/uuid-1';
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
}));

let mockUserInfo: any = null;
jest.mock('@ala/common-ui', () => ({
    useUser: () => ({ userInfo: mockUserInfo }),
    handleLogin: jest.fn(),
}));

describe('Doi', () => {
    const setBreadcrumbs = jest.fn();

    beforeEach(() => {
        mockNavigate.mockClear();
        setBreadcrumbs.mockClear();
        mockPathname = '/doi/uuid-1';
        mockUserInfo = null;
        (globalThis as any).fetch = jest.fn();
        (globalThis as any).alert = jest.fn();
    });

    function renderDoi(doi?: string) {
        return render(
            <MemoryRouter>
                <Doi setBreadcrumbs={setBreadcrumbs} isMobile={false} doi={doi} breadcrumb={<div>crumb</div>} />
            </MemoryRouter>
        );
    }

    it('shows a loading state before data resolves', () => {
        (globalThis.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

        renderDoi();

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows "No DOI found" when entityUid is empty', async () => {
        mockPathname = '/doi/';
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 404 });

        renderDoi();

        // entityUid becomes '' -> fetchData short-circuits without calling fetch
        await waitFor(() => expect(screen.getByText(/No DOI found with ID/)).toBeInTheDocument());
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('shows "No DOI found" for a 404 response', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 404 });

        renderDoi();

        await waitFor(() => expect(screen.getByText(/No DOI found with ID: uuid-1/)).toBeInTheDocument());
    });

    it('shows an error message when the fetch rejects', async () => {
        (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('boom'));

        renderDoi();

        await waitFor(() => expect(screen.getByText('Failed to load DOI information')).toBeInTheDocument());
    });

    it('renders DOI details on success, without a title span when providerMetadata.title is absent', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            title: 'Raw title',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });

        renderDoi();

        await waitFor(() => expect(screen.getByText(/DOI:/)).toBeInTheDocument());
        expect(screen.queryByText(/Occurrence records download on/)).not.toBeInTheDocument();
    });

    it('shows "not logged in" download-unavailable message with login link when anonymous', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });
        mockUserInfo = { authenticated: false };

        renderDoi();

        await waitFor(() => expect(screen.getByText(/log in/)).toBeInTheDocument());
        expect(screen.queryByText('Download file')).not.toBeInTheDocument();
    });

    it('shows the download button for an authenticated user with no authorisedRoles restriction', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });
        mockUserInfo = { authenticated: true, roles: [] };

        renderDoi();

        await waitFor(() => expect(screen.getByText('Download file')).toBeInTheDocument());
    });

    it('shows "insufficient permissions" when the user lacks required authorisedRoles', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            authorisedRoles: ['ROLE_SDS_ACT'],
            applicationMetadata: { recordCount: 1, searchUrl: 'https://example.com/search', datasets: [] },
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });
        mockUserInfo = { authenticated: true, roles: ['ROLE_USER'] };

        renderDoi();

        await waitFor(() => expect(screen.getByText(/Insufficient permissions to download this file/)).toBeInTheDocument());
        expect(screen.getByText('Start a new search and download')).toBeInTheDocument();
    });

    it('allows download when the admin role is present, even without the specific authorisedRole', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            authorisedRoles: ['ROLE_SDS_ACT'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });
        mockUserInfo = { authenticated: true, roles: ['ROLE_ADMIN'] };

        renderDoi();

        await waitFor(() => expect(screen.getByText('Download file')).toBeInTheDocument());
    });

    it('shows "file not available" when there is no filename', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: null,
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: { recordCount: 1, searchUrl: 'https://example.com/search', datasets: [] },
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });
        mockUserInfo = { authenticated: true, roles: [] };

        renderDoi();

        await waitFor(() => expect(screen.getByText(/This file is no longer available/)).toBeInTheDocument());
    });

    it('does not render the header/breadcrumb when used as an embedded doi (doi prop provided)', async () => {
        const data = {
            uuid: 'uuid-embedded',
            doi: '10.1/embedded',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });

        renderDoi('10.1/embedded');

        await waitFor(() => expect(screen.getByText(/DOI:/)).toBeInTheDocument());
        expect(screen.queryByText('crumb')).not.toBeInTheDocument();
        expect(screen.queryByText('DOI Details')).not.toBeInTheDocument();
    });

    it('shows an "unpublished" warning banner when active is false', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            description: 'desc',
            active: false,
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, json: () => Promise.resolve(data) });

        renderDoi();

        await waitFor(() => expect(screen.getByText(/Unpublished/)).toBeInTheDocument());
    });

    it('download() alerts "Download URL not found" when the download response has no url', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock)
            .mockResolvedValueOnce({ status: 200, json: () => Promise.resolve(data) })
            .mockResolvedValueOnce({ status: 200, json: () => Promise.resolve({}) });
        mockUserInfo = { authenticated: true, roles: [] };

        renderDoi();

        await waitFor(() => screen.getByText('Download file'));
        screen.getByText('Download file').click();

        await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Download URL not found'));
    });

    it('download() alerts "Download failed" when the download request is not 200', async () => {
        const data = {
            uuid: 'uuid-1',
            doi: '10.1/abc',
            filename: 'file.zip',
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };
        (globalThis.fetch as jest.Mock)
            .mockResolvedValueOnce({ status: 200, json: () => Promise.resolve(data) })
            .mockResolvedValueOnce({ status: 403 });
        mockUserInfo = { authenticated: true, roles: [] };

        renderDoi();

        await waitFor(() => screen.getByText('Download file'));
        screen.getByText('Download file').click();

        await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Download failed'));
    });
});
