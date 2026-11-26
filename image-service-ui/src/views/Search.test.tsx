/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MemoryRouter} from 'react-router-dom';
import {NuqsAdapter} from 'nuqs/adapters/react-router';
import Search from './Search';
import {searchApi} from '../api/endpoints';

jest.mock('@ala/common-ui', () => ({
    useUser: () => ({userInfo: (globalThis as any).__mockUserInfo ?? null}),
    Pagination: (props: any) => <div data-testid="pagination" data-page={props.page} data-max={props.maxResults}/>
}));

jest.mock('../api/endpoints', () => ({
    searchApi: {
        search: jest.fn(),
        facets: jest.fn(),
        downloadUrl: jest.fn(() => 'http://api.test/api/v2/search/download')
    },
    criteriaApi: {
        list: jest.fn().mockResolvedValue({results: []})
    }
}));

const searchResult = {
    results: [
        {imageId: 'img-1', title: 'Banksia', thumbnailUrl: 'http://x/thumb1.jpg', isImage: true, isAudio: false, isDocument: false}
    ],
    totalRecords: 1,
    pageSize: 24,
    startIndex: 0
};

const facets = [{name: 'mimeType', label: 'File type', values: [{value: 'image/jpeg', count: 1}]}];

function renderSearch() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <NuqsAdapter>
                <Search setBreadcrumbs={jest.fn()} isMobile={false}/>
            </NuqsAdapter>
        </MemoryRouter>
    );
}

describe('Search', () => {
    beforeEach(() => {
        (globalThis as any).__mockUserInfo = null;
        (searchApi.search as jest.Mock).mockReset().mockResolvedValue(searchResult);
        (searchApi.facets as jest.Mock).mockReset().mockResolvedValue(facets);
    });

    it('renders results and facets returned by the search API', async () => {
        renderSearch();

        await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('1 image found'));
        expect(searchApi.search).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({pageSize: 30}));
        expect(screen.getByTestId('thumbnail-grid')).toBeInTheDocument();
        expect(screen.getByTestId('facet-panel')).toHaveTextContent('File type');
    });

    it('shows the public image criteria when the backend returns no definitions', async () => {
        renderSearch();

        fireEvent.click(screen.getByTestId('toggle-advanced-criteria'));
        await waitFor(() => expect(screen.getByRole('option', {name: 'Image alternateFilename'})).toBeInTheDocument());
        expect(screen.getByRole('option', {name: 'Image creator'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'Image type'})).toBeInTheDocument();
    });

    it('shows an error state when the search request fails', async () => {
        (searchApi.search as jest.Mock).mockRejectedValue(Object.assign(new Error('Service unavailable'), {name: 'ApiError'}));

        renderSearch();

        await waitFor(() => expect(screen.getByTestId('search-error')).toHaveTextContent('Service unavailable'));
    });

    it('does not render the authenticated download button for anonymous users', async () => {
        renderSearch();
        await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('1 image found'));
        expect(screen.queryByTestId('download-zip')).not.toBeInTheDocument();
    });

    it('renders the authenticated download button for logged-in users', async () => {
        (globalThis as any).__mockUserInfo = {authenticated: true, roles: ['ROLE_USER']};
        renderSearch();
        await waitFor(() => expect(screen.getByTestId('download-zip')).toBeInTheDocument());
    });
});
