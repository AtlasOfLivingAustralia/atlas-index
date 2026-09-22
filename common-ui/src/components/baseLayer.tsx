/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TileLayer } from 'react-leaflet';
import { createElementObject, createLayerComponent } from '@react-leaflet/core';
import type { LayerProps } from '@react-leaflet/core';
import L from 'leaflet';
import type { StyleSpecification } from 'maplibre-gl';
import '@maplibre/maplibre-gl-leaflet';

interface VectorBasemapLayerProps extends LayerProps {
    /** A MapLibre style URL, or an inline StyleSpecification object. */
    style: string | StyleSpecification;
}

/**
 * Embeds a MapLibre GL vector-tile layer inside a Leaflet map (via the
 * `@maplibre/maplibre-gl-leaflet` bridge), as a proper react-leaflet layer
 * component — usable directly inside `<MapContainer>` or as a
 * `<LayersControl.BaseLayer>` child alongside other base layers (e.g.
 * `TileLayer`, `WMSTileLayer`).
 *
 * On `style` change the underlying MapLibre map's style is swapped in place
 * via `setStyle` rather than recreating the layer.
 */
const VectorBasemapLayer = createLayerComponent<L.MaplibreGL, VectorBasemapLayerProps>(
    function createVectorBasemapLayer({ style, ...options }, context) {
        const layer = L.maplibreGL({ style, ...options });
        return createElementObject(layer, context);
    },
    function updateVectorBasemapLayer(layer, props, prevProps) {
        if (props.style !== prevProps.style) {
            const glMap = layer.getMaplibreMap();
            glMap.setStyle(props.style as StyleSpecification | string);
        }
    }
);

export interface BaseLayerProps {
    /** A MapLibre style URL, or an inline StyleSpecification object. */
    vectorTileStyleUrl?: string | StyleSpecification;
    /** Tile URL for raster XYZ tiles (e.g. OpenStreetMap). */
    tileUrl?: string;
    /** Attribution string for the raster tile layer. */
    tileAttribution?: string;
    /** z-index for the raster tile layer. Defaults to 1. */
    zIndex?: number;
}

/**
 * Renders the map's OpenStreetMap-derived base layer:
 *
 * - `vectorTileStyleUrl` set → renders a MapLibre GL vector-tile basemap
 *   from that style URL, embedded in Leaflet via `VectorBasemapLayer`.
 * - otherwise, `tileUrl` set → renders a classic raster XYZ `TileLayer`.
 *
 * If both are set, the vector layer takes precedence.
 * At least one of `vectorTileStyleUrl` or `tileUrl` is required; throws an Error if neither is provided.
 */
export function BaseLayer({
    vectorTileStyleUrl,
    tileUrl,
    tileAttribution,
    zIndex = 1,
}: BaseLayerProps = {}) {
    if (vectorTileStyleUrl) {
        return <VectorBasemapLayer style={vectorTileStyleUrl} pane='tilePane' />;
    }

    if (!tileUrl) {
        throw new Error('BaseLayer: at least one of vectorTileStyleUrl or tileUrl must be provided.');
    }

    return <TileLayer attribution={tileAttribution} url={tileUrl} zIndex={zIndex} />;
}

export default BaseLayer;
