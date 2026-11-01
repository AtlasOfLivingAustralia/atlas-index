/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ImageDetail from './ImageDetail';
import {imageApi} from '../api/endpoints';
import {ApiError} from '../api/client';

jest.mock('@ala/common-ui', () => ({
    useUser: () => ({userInfo: (globalThis as any).__mockUserInfo ?? null})
}));

jest.mock('../components/imageViewer', () => () => <div data-testid="mock-image-viewer"/>);

jest.mock('../api/endpoints', () => ({
    imageApi: {
        getDetail: jest.fn(),
        attachTag: jest.fn(),
        detachTag: jest.fn(),
        calibrate: jest.fn(),
        resetCalibration: jest.fn(),
        createSubimage: jest.fn(),
        deleteImage: jest.fn(),
        updateMetadata: jest.fn(),
        removeMetadataKey: jest.fn(),
        regenerateDerivatives: jest.fn(),
        resetTiles: jest.fn(),
        setHarvestable: jest.fn()
    },
    tagApi: {
        create: jest.fn()
    }
}));

const baseImage = {
    imageId: 'img-001',
    title: 'Banksia serrata flower',
    thumbnailUrl: 'http://x/thumb.jpg',
    imageUrl: 'http://x/full.jpg',
    originalUrl: 'http://x/original.jpg',
    metadataUrl: 'http://x/metadata.json',
    width: 2048,
    height: 1536,
    isImage: true,
    isAudio: false,
    isDocument: false,
    subimages: [],
    tags: [{id: 1, path: 'Botany'}, {id: 2, path: 'Botany/Flower'}],
    coreMetadata: [{key: 'scientificName', value: 'Banksia serrata'}],
    systemMetadata: [],
    embeddedMetadata: [],
    userMetadata: [],
    dataResourceMetadata: [],
    isCalibrated: false,
    deleted: false
};

function renderDetail() {
    return render(
        <MemoryRouter initialEntries={['/image/img-001']}>
            <Routes>
                <Route path="/image/:imageId" element={<ImageDetail setBreadcrumbs={jest.fn()}/>}/>
            </Routes>
        </MemoryRouter>
    );
}

describe('ImageDetail', () => {
    beforeEach(() => {
        (globalThis as any).__mockUserInfo = null;
        (imageApi.getDetail as jest.Mock).mockReset().mockResolvedValue(baseImage);
    });

    it('renders tags and core metadata for anonymous users, without edit controls', async () => {
        renderDetail();

        await waitFor(() => expect(screen.getByTestId('image-detail')).toBeInTheDocument());
        expect(screen.getByTestId('tag-list')).toHaveTextContent('Botany');
        expect(screen.queryByTestId('add-tag-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-image')).not.toBeInTheDocument();
    });

    it('shows authenticated edit affordances (delete) once logged in, but not tag creation (admin-only)', async () => {
        (globalThis as any).__mockUserInfo = {authenticated: true, roles: ['ROLE_USER']};
        renderDetail();

        await waitFor(() => expect(screen.getByTestId('delete-image')).toBeInTheDocument());
        // Creating a new tag requires the admin-gated POST /api/v2/admin/tags endpoint,
        // so a plain authenticated (non-admin) user should not see the add-tag form.
        expect(screen.queryByTestId('add-tag-input')).not.toBeInTheDocument();
    });

    it('shows the add-tag form and admin actions for an admin user', async () => {
        (globalThis as any).__mockUserInfo = {authenticated: true, roles: ['ROLE_USER', 'ROLE_ADMIN']};
        renderDetail();

        await waitFor(() => expect(screen.getByTestId('add-tag-input')).toBeInTheDocument());
        expect(screen.getByTestId('delete-image')).toBeInTheDocument();
        expect(screen.getByTestId('regenerate-derivatives')).toBeInTheDocument();
        expect(screen.getByTestId('reset-tiles')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-harvestable')).toBeInTheDocument();
    });

    it('shows a not-found state for a 404 response', async () => {
        (imageApi.getDetail as jest.Mock).mockRejectedValue(new ApiError(404, 'Not found'));
        renderDetail();
        await waitFor(() => expect(screen.getByTestId('image-detail-not-found')).toBeInTheDocument());
    });

    it('shows a linked parent-image section for a sub-image', async () => {
        (imageApi.getDetail as jest.Mock).mockResolvedValue({
            ...baseImage,
            parentImageId: 'parent-001',
            parentImageTitle: 'Original specimen image',
            parentImageThumbnailUrl: 'http://x/parent-thumb.jpg'
        });
        renderDetail();

        const section = await screen.findByTestId('parent-image-section');
        expect(section).toHaveTextContent('Original specimen image');
        expect(screen.getByRole('link', {name: /Parent image Original specimen image/})).toHaveAttribute('href', '/image/parent-001');
    });

    it('shows an unauthorized state for a 403 response', async () => {
        (imageApi.getDetail as jest.Mock).mockRejectedValue(new ApiError(403, 'Forbidden'));
        renderDetail();
        await waitFor(() => expect(screen.getByTestId('image-detail-unauthorized')).toBeInTheDocument());
    });
});
