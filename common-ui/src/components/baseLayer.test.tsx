/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BaseLayer from './baseLayer';

jest.mock('react-leaflet', () => ({
    TileLayer: jest.fn((props: any) => <div data-testid="tile-layer" data-url={props.url} data-attribution={props.attribution} data-zindex={props.zIndex} />),
}));

jest.mock('@react-leaflet/core', () => ({
    createLayerComponent: () => {
        return function MockVectorBasemapLayer(props: any) {
            return <div data-testid="vector-basemap-layer" data-style={props.style} data-pane={props.pane} />;
        };
    },
    createElementObject: jest.fn(),
}));

jest.mock('leaflet', () => ({
    maplibreGL: jest.fn(),
}));

jest.mock('@maplibre/maplibre-gl-leaflet', () => ({}));
jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

describe('BaseLayer', () => {
    it('throws an error when neither vectorTileStyleUrl nor tileUrl is provided', () => {
        // Suppress console.error in React during the expected throw
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<BaseLayer />)).toThrow(
            'BaseLayer: at least one of vectorTileStyleUrl or tileUrl must be provided.'
        );
        consoleSpy.mockRestore();
    });

    it('renders VectorBasemapLayer when vectorTileStyleUrl is provided', () => {
        render(<BaseLayer vectorTileStyleUrl="https://example.com/style.json" />);
        const vectorLayer = screen.getByTestId('vector-basemap-layer');
        expect(vectorLayer).toBeInTheDocument();
        expect(vectorLayer).toHaveAttribute('data-style', 'https://example.com/style.json');
        expect(vectorLayer).toHaveAttribute('data-pane', 'tilePane');
    });

    it('renders TileLayer when only tileUrl and attribution are provided', () => {
        render(
            <BaseLayer
                tileUrl="https://tiles.example.org/{z}/{x}/{y}.png"
                tileAttribution={'&copy; OpenStreetMap'}
                zIndex={2}
            />
        );
        const tileLayer = screen.getByTestId('tile-layer');
        expect(tileLayer).toBeInTheDocument();
        expect(tileLayer).toHaveAttribute('data-url', 'https://tiles.example.org/{z}/{x}/{y}.png');
        expect(tileLayer).toHaveAttribute('data-attribution', '&copy; OpenStreetMap');
        expect(tileLayer).toHaveAttribute('data-zindex', '2');
    });

    it('prefers vectorTileStyleUrl over tileUrl when both are provided', () => {
        render(
            <BaseLayer
                vectorTileStyleUrl="https://example.com/style.json"
                tileUrl="https://tiles.example.org/{z}/{x}/{y}.png"
                tileAttribution="&copy; OpenStreetMap"
            />
        );
        expect(screen.getByTestId('vector-basemap-layer')).toBeInTheDocument();
        expect(screen.queryByTestId('tile-layer')).not.toBeInTheDocument();
    });
});
