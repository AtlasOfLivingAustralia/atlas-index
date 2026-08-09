/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import Browse from './Browse.tsx';

// Base response shape used across tests. Facets are deliberately given more
// than one value for each rank so auto-drill (see Browse.tsx: single facet
// value triggers an automatic re-fetch) does not kick in, keeping tests
// focused on a single fetch/render cycle. Auto-drill itself is exercised by
// the Playwright acceptance test `collection-browse`.
function buildResponse(overrides: Partial<any> = {}) {
    return {
        totalRecords: 4,
        occurrences: [
            {
                uuid: 'u1',
                scientificName: 'Coleoptera sp.',
                vernacularName: 'Beetle',
                typeStatus: 'HOLOTYPE',
                imageMetadata: [
                    {
                        imageId: 'img1',
                        thumbWidth: 400,
                        thumbHeight: 300,
                        thumbUrl: 'https://images.test.ala.org.au/img1.jpg',
                        rightsHolder: 'Test Museum',
                        license: 'CC BY 4.0',
                    },
                ],
            },
            {
                uuid: 'u2',
                scientificName: 'Formicidae sp.',
                // no imageMetadata - should be skipped when rendering images
            },
        ],
        facetResults: [
            {
                fieldName: 'typeStatus',
                fieldResult: [
                    { label: 'HOLOTYPE', count: 1, fq: 'typeStatus:"HOLOTYPE"' },
                    { label: 'PARATYPE', count: 2, fq: 'typeStatus:"PARATYPE"' },
                ],
            },
            {
                fieldName: 'raw_sex',
                fieldResult: [
                    { label: 'Male', count: 2, fq: 'raw_sex:"Male"' },
                    { label: 'Female', count: 2, fq: 'raw_sex:"Female"' },
                ],
            },
            {
                fieldName: 'kingdom',
                fieldResult: [
                    { label: 'Animalia', count: 3, fq: 'kingdom:"Animalia"' },
                    { label: 'Plantae', count: 1, fq: 'kingdom:"Plantae"' },
                ],
            },
        ],
        ...overrides,
    };
}

function jsonResponse(body: any, ok = true, status = 200) {
    return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
    } as Response);
}

function renderBrowse(entityUid?: string) {
    const initialEntry = entityUid ? `/browse/${entityUid}` : '/browse';
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route
                    path="/browse/:entityUid?"
                    element={<Browse setBreadcrumbs={jest.fn()} />}
                />
            </Routes>
        </MemoryRouter>
    );
}

describe('Browse', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        window.fetch = fetchMock as unknown as typeof fetch;
        window.location.hash = '';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('shows a loading indicator while the request is in flight', async () => {
        fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
        renderBrowse();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders images and summary once data has loaded', async () => {
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument()
        );

        // occ u2 has no imageMetadata and should be skipped
        expect(screen.queryByText('Formicidae sp.')).not.toBeInTheDocument();

        expect(document.querySelector('.images-summary')).toHaveTextContent(
            '1'
        );
        expect(
            document.querySelector('.total-records')
        ).toHaveTextContent('4');
    });

    it('shows a "no results" message on a 404 response', async () => {
        fetchMock.mockReturnValue(jsonResponse({}, false, 404));
        renderBrowse();

        await waitFor(() =>
            expect(
                screen.getByText('No images are available for this search.')
            ).toBeInTheDocument()
        );
    });

    it('shows an error message when the request fails', async () => {
        fetchMock.mockReturnValue(jsonResponse({}, false, 500));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getByText('An error occurred.')).toBeInTheDocument()
        );
    });

    it('shows an error message when fetch rejects', async () => {
        fetchMock.mockReturnValue(Promise.reject(new Error('network down')));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getByText('An error occurred.')).toBeInTheDocument()
        );
    });

    it('includes a collectionUid filter in the request when entityUid starts with c', async () => {
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));
        renderBrowse('co56');

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const requestedUrl = fetchMock.mock.calls[0][0] as string;
        expect(requestedUrl).toContain('fq=collectionUid:co56');
    });

    it('requests the next page and appends results when "Show more results" is clicked', async () => {
        fetchMock.mockReturnValueOnce(jsonResponse(buildResponse()));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument()
        );

        const showMoreButton = screen.getByText('Show more results');

        fetchMock.mockReturnValueOnce(
            jsonResponse(
                buildResponse({
                    occurrences: [
                        {
                            uuid: 'u3',
                            scientificName: 'Second page sp.',
                            imageMetadata: [
                                {
                                    imageId: 'img3',
                                    thumbWidth: 400,
                                    thumbHeight: 300,
                                    thumbUrl:
                                        'https://images.test.ala.org.au/img3.jpg',
                                },
                            ],
                        },
                    ],
                })
            )
        );

        fireEvent.click(showMoreButton);

        await waitFor(() =>
            expect(screen.getAllByText('Second page sp.')[0]).toBeInTheDocument()
        );

        // original image should still be present since results accumulate
        expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument();

        const secondCallUrl = fetchMock.mock.calls[1][0] as string;
        expect(secondCallUrl).toContain('&start=2'); // VITE_PAGE_SIZE=2 in jest.setup.ts
    });

    it('falls back to the missing-image asset when an image fails to load', async () => {
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument()
        );

        const img = screen.getByAltText('Coleoptera sp.') as HTMLImageElement;
        fireEvent.error(img);
        expect(img.src).toContain('test-file-stub');
    });

    it('applies a filter and removes it via "all values"', async () => {
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument()
        );

        fetchMock.mockClear();
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));

        const typeStatusFacet = document.querySelector(
            '.typeStatus-facet'
        ) as HTMLElement;
        fireEvent.click(within(typeStatusFacet).getByText('HOLOTYPE'));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        let requestedUrl = fetchMock.mock.calls[0][0] as string;
        expect(requestedUrl).toContain('fq=typeStatus:"HOLOTYPE"');

        fetchMock.mockClear();
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));

        const updatedTypeStatusFacet = document.querySelector(
            '.typeStatus-facet'
        ) as HTMLElement;
        fireEvent.click(
            within(updatedTypeStatusFacet).getByText('all values')
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        requestedUrl = fetchMock.mock.calls[0][0] as string;
        expect(requestedUrl).not.toContain('fq=typeStatus');
    });

    it('resets all filters when "Clear filters" is clicked', async () => {
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));
        renderBrowse();

        await waitFor(() =>
            expect(screen.getAllByText('Coleoptera sp.')[0]).toBeInTheDocument()
        );

        fireEvent.click(
            within(document.querySelector('.typeStatus-facet') as HTMLElement).getByText(
                'HOLOTYPE'
            )
        );
        await waitFor(() =>
            expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
        );

        fetchMock.mockClear();
        fetchMock.mockReturnValue(jsonResponse(buildResponse()));

        fireEvent.click(screen.getByText('Clear filters'));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const requestedUrl = fetchMock.mock.calls[0][0] as string;
        expect(requestedUrl).not.toContain('fq=typeStatus');
    });
});
