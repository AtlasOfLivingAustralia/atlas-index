/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageViewer, {AlaTmsTileLayer} from './imageViewer';
import L from 'leaflet';

describe('ImageViewer', () => {
    it('renders the map container', () => {
        render(<ImageViewer apiUrl="http://localhost:8080" imageId="test-img-123" width={2048} height={1536} tileSize={256}/>);
        expect(screen.getByTestId('image-viewer-map')).toBeInTheDocument();
    });

    it('inverts Y coordinate correctly in AlaTmsTileLayer for TMS compatibility', () => {
        const layer = new AlaTmsTileLayer('http://localhost:8080/image/test-img-123/tms/{z}/{x}/{y}.png', {
            minZoom: 0,
            maxZoom: 5,
            maxNativeZoom: 3
        });

        // Mock _getZoomForUrl
        (layer as any)._getZoomForUrl = () => 2;

        // In Leaflet CRS.Simple, top tile row has coords.y = -3, bottom tile row has coords.y = -1
        // For coords.y = -1, TMS y = -1 - (-1) = 0 (bottom row)
        expect(layer.getTileUrl({x: 0, y: -1, z: 2} as unknown as L.Coords)).toBe(
            'http://localhost:8080/image/test-img-123/tms/2/0/0.png'
        );

        // For coords.y = -3, TMS y = -1 - (-3) = 2 (top row)
        expect(layer.getTileUrl({x: 1, y: -3, z: 2} as unknown as L.Coords)).toBe(
            'http://localhost:8080/image/test-img-123/tms/2/1/2.png'
        );
    });
});
