/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MemoryRouter} from 'react-router-dom';
import ThumbnailGrid from './thumbnailGrid';
import type {ImageSummary} from '../api/types';

const image = (overrides: Partial<ImageSummary> = {}): ImageSummary => ({
    imageId: 'img-1',
    thumbnailUrl: 'http://example.test/thumb.jpg',
    isImage: true,
    isAudio: false,
    isDocument: false,
    ...overrides
});

describe('ThumbnailGrid', () => {
    it('renders an empty state when there are no results', () => {
        render(<MemoryRouter><ThumbnailGrid results={[]}/></MemoryRouter>);
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });

    it('renders a card per result, linking to the image detail route', () => {
        render(
            <MemoryRouter>
                <ThumbnailGrid results={[image({imageId: 'img-1', title: 'First'}), image({imageId: 'img-2', title: 'Second'})]}/>
            </MemoryRouter>
        );

        const cards = screen.getAllByTestId('thumbnail-card');
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveAttribute('href', '/image/img-1');
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
    });

    it('falls back to originalFilename then imageId when no title is set', () => {
        render(
            <MemoryRouter>
                <ThumbnailGrid results={[image({imageId: 'img-3', originalFilename: 'photo.jpg'})]}/>
            </MemoryRouter>
        );
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });

    it('falls back to imageIdentifier and generates a default thumbnailUrl when not explicitly present', () => {
        const rawItem = {
            imageIdentifier: 'uuid-1234',
            title: 'Sample Photo'
        } as unknown as ImageSummary;

        render(
            <MemoryRouter>
                <ThumbnailGrid results={[rawItem]} apiUrl="http://api.test"/>
            </MemoryRouter>
        );

        const card = screen.getByTestId('thumbnail-card');
        expect(card).toHaveAttribute('href', '/image/uuid-1234');
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'http://api.test/image/uuid-1234/thumbnail');
    });
});
