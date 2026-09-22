/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo, useState } from 'react';
import type { TileLayer as LeafletTileLayer } from 'leaflet';
import { TileLayer, useMap } from 'react-leaflet';
import { extendContext, LeafletContext, useLeafletContext } from '@react-leaflet/core';
import ReactLeafletGoogleLayerBase from 'react-leaflet-google-layer';

const ReactLeafletGoogleLayer = ((ReactLeafletGoogleLayerBase as any)?.default ?? ReactLeafletGoogleLayerBase) as any;

// 1x1 transparent gif, used for the placeholder tiles
const TRANSPARENT_TILE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export type LazyGoogleLayerType = 'roadmap' | 'terrain' | 'satellite' | 'hybrid';

export interface LazyGoogleLayerProps {
    apiKey: string;
    type: LazyGoogleLayerType;
    zIndex?: number;
}

/**
 * A Google base layer that is only created when it is selected in the layer selector.
 *
 * A placeholder TileLayer is created synchronously so that the enclosing LayersControl registers
 * this base layer immediately, i.e. the layer selector looks the same before and after the Google
 * Maps JS API has been loaded. The real Google layer (and therefore the Maps JS API request) is
 * only created when this base layer is selected on the map, and is disposed of when it is
 * deselected.
 */
function LazyGoogleLayer({ apiKey, type, zIndex = 1 }: LazyGoogleLayerProps) {
    const map = useMap();
    const context = useLeafletContext();
    const [placeholder, setPlaceholder] = useState<LeafletTileLayer | null>(null);
    const [active, setActive] = useState(false);

    // the placeholder is only on the map while this base layer is the selected base layer
    useEffect(() => {
        if (!placeholder || !map?.hasLayer) {
            return;
        }

        const update = () => setActive(map.hasLayer(placeholder));
        update();

        map.on('layeradd', update);
        map.on('layerremove', update);

        return () => {
            map.off('layeradd', update);
            map.off('layerremove', update);
        };
    }, [map, placeholder]);

    // drop the LayersControl container from the context so that the Google layer is added directly
    // to the map, instead of registering a duplicate entry in the layer selector
    const mapOnlyContext = useMemo(() => extendContext(context, { layerContainer: undefined, layersControl: undefined }), [context]);

    return (
        <>
            <TileLayer ref={setPlaceholder as any} url={TRANSPARENT_TILE} zIndex={zIndex} />
            {active && (
                <LeafletContext.Provider value={mapOnlyContext}>
                    <ReactLeafletGoogleLayer apiKey={apiKey} type={type} zIndex={zIndex} />
                </LeafletContext.Provider>
            )}
        </>
    );
}

export default LazyGoogleLayer;

