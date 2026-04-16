/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState } from 'react';
import { MapDistribution } from './mapRefineSection';

interface CachedMapControlLayer {
    id: string;
    type: 'base' | 'occurrences' | 'distribution';
    label: string;
    dataResourceName?: string;
    geomIdx?: string;
}

interface CachedMapControlProps {
    /** All layers in the current metadata */
    layers: CachedMapControlLayer[];
    /** Base layer ids enabled in env config (determines order + availability) */
    configuredBaseLayers: string[];
    /** Currently selected base layer id */
    activeBaseLayerId: string;
    onBaseLayerChange: (id: string) => void;
    showOccurrences: boolean;
    onToggleOccurrences: () => void;
    distributions: MapDistribution[];
    onToggleDistribution: (idx: number) => void;
}

const BASE_LAYER_LABELS: Record<string, string> = {
    base: 'OpenStreetMap',
    base_google_satellite: 'Satellite',
    base_google_roads: 'Roads',
    base_google_hybrid: 'Hybrid'
};

function isOverlayVisible(layer: CachedMapControlLayer, showOccurrences: boolean, distributions: MapDistribution[]): boolean {
    if (layer.type === 'occurrences') return showOccurrences;
    if (layer.type === 'distribution') {
        // geomIdx is the unique id
        const match = distributions.find(d => String(d.geomIdx) === String(layer.geomIdx));
        return match?.checked ?? true;
    }
    return true;
}

/**
 * Leaflet-style layer control for cachedMapView.tsx
 * Uses Leaflet's own CSS classes so it looks the same.
 */
function CachedMapControl({ layers, configuredBaseLayers, activeBaseLayerId, onBaseLayerChange, showOccurrences, onToggleOccurrences, distributions, onToggleDistribution }: CachedMapControlProps) {
    const [open, setOpen] = useState(false);

    const availableBaseLayers = configuredBaseLayers.map(id => layers.find(l => l.type === 'base' && l.id === id)).filter(Boolean) as CachedMapControlLayer[];

    const overlayLayers = layers.filter(l => l.type === 'occurrences' || l.type === 'distribution');

    if (overlayLayers.length === 0 && configuredBaseLayers.length <= 1) return null;

    const showBaseSeparator = overlayLayers.length > 0;

    return (
        <div className='leaflet-top leaflet-right' style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div className={`leaflet-control-layers leaflet-control${open ? ' leaflet-control-layers-expanded' : ''}`} aria-haspopup='true' style={{ pointerEvents: 'auto' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
                <a className='leaflet-control-layers-toggle' href='#' title='Layers' role='button' onClick={e => e.preventDefault()} />

                <section className='leaflet-control-layers-list'>
                    {configuredBaseLayers.length > 0 && (
                        <div className='leaflet-control-layers-base'>
                            {availableBaseLayers.length > 1 ? (
                                availableBaseLayers.map(bl => (
                                    <label key={bl.id}>
                                        <span>
                                            <input type='radio' className='leaflet-control-layers-selector' name='cached-base-layers' checked={activeBaseLayerId === bl.id} onChange={() => onBaseLayerChange(bl.id)} />
                                            <span> {BASE_LAYER_LABELS[bl.id] ?? bl.id}</span>
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', display: 'block', lineHeight: '1.3' }}>Enable interactive map for more base layers</span>
                            )}
                        </div>
                    )}

                    {showBaseSeparator && <div className='leaflet-control-layers-separator' />}

                    {/* layer checkboxes performing the same function as the mapRefineSection.tsx's controles */}
                    {overlayLayers.length > 0 && (
                        <div className='leaflet-control-layers-overlays'>
                            {overlayLayers.map(layer => {
                                const checked = isOverlayVisible(layer, showOccurrences, distributions);
                                const handleChange =
                                    layer.type === 'occurrences'
                                        ? onToggleOccurrences
                                        : () => {
                                              const idx = distributions.findIndex(d => String(d.geomIdx) === String(layer.geomIdx));
                                              if (idx !== -1) onToggleDistribution(idx);
                                          };
                                return (
                                    <label key={layer.id}>
                                        <span>
                                            <input type='checkbox' className='leaflet-control-layers-selector' checked={checked} onChange={handleChange} />
                                            <span>
                                                {' '}
                                                {layer.label}
                                                {layer.type === 'distribution' && layer.dataResourceName ? `, ${layer.dataResourceName}` : ''}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default CachedMapControl;
