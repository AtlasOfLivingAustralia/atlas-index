/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from 'react';
import CachedMapControl from './cachedMapControl';
import Legend from './mapLegend';
import { CachedZoomOption, MapDistribution } from './mapRefineSection';
import classes from './species.module.css';

interface CachedMapLayer {
    id: string;
    type: 'base' | 'occurrences' | 'distribution';
    label: string;
    sharedFile?: string; // set for base layers — path relative to baseUrl
    dataResourceUid?: string;
    dataResourceName?: string;
    geomIdx?: string;
}

interface CachedMapAttributions {
    base: string; // OSM attribution (backward compat)
    baseLayers: { id: string; attribution: string }[]; // per base-layer attributions
    occurrences: string;
    distributions: { geomIdx: string; text: string }[];
}

interface CachedMapZoom {
    label: string;
    targetBbox: [number, number, number, number] | null;
    canvasBbox: [number, number, number, number];
    layers: CachedMapLayer[];
    attributions: CachedMapAttributions;
}

interface CachedMapMetadata {
    guid: string;
    imageWidth: number;
    imageHeight: number;
    occurrenceCount: number;
    /** Scaled hex-bin colour values: [hexString, count | null][] — used by the Legend component */
    hexBinValues: [string, number | null][];
    /** Opacity of the occurrence layer — used to match legend bar opacity */
    mapLayerOpacity: number;
    zooms: Record<string, CachedMapZoom>;
    generated: string;
}

interface CachedMapViewProps {
    result?: Record<PropertyKey, string | number | any>;
    isMobile: boolean;
    showOccurrences: boolean;
    onToggleOccurrences: () => void;
    distributions: MapDistribution[];
    onToggleDistribution: (idx: number) => void;
    /** Active zoom id — owned by mapView so the refine section can control it */
    activeZoom: string;
    onZoomsLoaded: (zooms: CachedZoomOption[]) => void;
    /** Called to change the active zoom — provided by mapView */
    onZoomChange: (zoomId: string) => void;
    /** Called when no cached map is available — parent should fall back to Leaflet */
    onUnavailable?: () => void;
}

/**
 * Renders output of taxon-map tool.
 * - base layer(s)
 * - occurrence layers for a taxon
 * - expert distributions for a taxon
 *
 * taxon-map's config and search-ui's config should be aligned as needed to smooth the transition between cachedMapView
 * and leaflet e.g. hexBinValues for occurrence WMS colour, default location and zoom
 *
 * Active when VITE_TAXON_MAP_ENABLED=true. VITE_TAXON_MAP_URL provides the
 * base URL for fetching metadata and images.
 *
 * File layout (resolved from VITE_TAXON_MAP_URL):
 *   {zoomId}_base.png – base map images
 *   {shard}/{encodedGuid}_map.json - metadata for the taxon
 *   {shard}/{encodedGuid}_{zoomId}_{layerId}.png - occurrence and distribution layers
 */
function CachedMapView({ result, isMobile, showOccurrences, onToggleOccurrences, distributions, onToggleDistribution, activeZoom, onZoomsLoaded, onZoomChange, onUnavailable }: CachedMapViewProps) {
    const [metadata, setMetadata] = useState<CachedMapMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeBaseLayerId, setActiveBaseLayerId] = useState<string>('base');
    const [zoomList, setZoomList] = useState<CachedZoomOption[]>([]);
    const [hasOccurrences, setHasOccurrences] = useState(false);

    const baseUrl = import.meta.env.VITE_TAXON_MAP_URL?.replace(/\/$/, '') ?? '';
    const configuredBaseLayers = (import.meta.env.VITE_TAXON_MAP_BASE_LAYERS ?? 'base').split(',').map((s: string) => s.trim()).filter(Boolean);
    const zoomData = metadata?.zooms?.[activeZoom] ?? null;

    useEffect(() => {
        if (!result?.guid) return;

        const encodedGuid = encodeURIComponent(encodeURIComponent(result.guid));

        setLoading(true);
        setError('');
        setMetadata(null);

        fetch(`${guidPath(encodedGuid)}_map.json`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<CachedMapMetadata>;
            })
            .then(m => {
                setMetadata(m);
                const zoomOptions: CachedZoomOption[] = Object.entries(m.zooms).map(([id, z]) => ({ id, label: z.label ?? id }));
                setZoomList(zoomOptions);
                onZoomsLoaded(zoomOptions);
                // Set activeBaseLayerId to the first configured base layer present
                const firstZoom = Object.values(m.zooms)[0];
                const firstBase = configuredBaseLayers.find((id: string) => firstZoom?.layers.some(l => l.type === 'base' && l.id === id));
                if (firstBase) setActiveBaseLayerId(firstBase);

                setHasOccurrences(m.occurrenceCount > 0);
            })
            .catch(_ => {
                if (onUnavailable) {
                    onUnavailable();
                } else {
                    setError('No cached map available for this taxon.');
                }
            })
            .finally(() => setLoading(false));
    }, [result]);

    if (!result?.guid) return <></>;
    const encodedGuid = encodeURIComponent(encodeURIComponent(result.guid));

    /** Build the path prefix for this guid. */
    function guidPath(encodedGuid: string): string {
        const shard = encodedGuid.slice(-2);
        return `${baseUrl}/${shard}/${encodedGuid}`;
    }

    /** URL for a layer PNG. Base layers use their sharedFile (directly under baseUrl). */
    function layerUrl(encodedGuid: string, zoomId: string, layer: CachedMapLayer): string {
        if (layer.sharedFile) {
            return `${baseUrl}/${layer.sharedFile}`;
        }
        return `${guidPath(encodedGuid)}_${zoomId}_${layer.id}.png`;
    }

    /**
     * Determine whether a cached layer should be visible.
     */
    function isLayerVisible(layer: CachedMapLayer): boolean {
        if (layer.type === 'base') return layer.id === activeBaseLayerId;
        if (layer.type === 'occurrences') return showOccurrences;
        if (layer.type === 'distribution') {
            const match = distributions.find(d => String(d.geomIdx) === String(layer.geomIdx));
            return match?.checked ?? true;
        }
        return true;
    }

    const mapHeight = 530;

    /** Convert EPSG:3857 metres to longitude (degrees) */
    function mercXToLon(x: number): number {
        return (x / 20037508.342789244) * 180;
    }

    /** Convert EPSG:3857 metresto latitude (degrees) */
    function mercYToLat(y: number): number {
        return (180 / Math.PI) * (2 * Math.atan(Math.exp((y / 20037508.342789244) * Math.PI)) - Math.PI / 2);
    }

    const viewportRef = useRef<HTMLDivElement>(null);
    const [viewportWidth, setViewportWidth] = useState<number>(0);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        setViewportWidth(el.clientWidth);
        const ro = new ResizeObserver(entries => {
            setViewportWidth(entries[0].contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [zoomData]);

    function visibleBbox(): { west: number; east: number; south: number; north: number } | null {
        if (!zoomData || !metadata) return null;
        const [mercWest, mercSouth, mercEast, mercNorth] = zoomData.canvasBbox;
        const fullW = metadata.imageWidth;
        const viewW = viewportWidth || fullW;
        const cropPx = Math.max(0, (fullW - viewW) / 2);
        const mercPerPx = (mercEast - mercWest) / fullW;
        return {
            west: mercXToLon(mercWest + cropPx * mercPerPx),
            east: mercXToLon(mercEast - cropPx * mercPerPx),
            south: mercYToLat(mercSouth),
            north: mercYToLat(mercNorth)
        };
    }

    // The metadata indicates image extents as well as the interior extents that must always be visible.
    // This is achieved by these calculations that will crop the left/right of the static images, and if required,
    // reduce the height of the image. When less than full width is visible the toggle between this and the leaflet
    // will show more variation.
    const vb = visibleBbox();
    const [tb0, , tb2] = zoomData?.targetBbox ?? [0, 0, 0, 0];
    const targetLonSpan = zoomData?.targetBbox ? tb2 - tb0 : null;
    const visibleLonSpan = vb ? vb.east - vb.west : null;
    const scaleFactor = targetLonSpan && visibleLonSpan && targetLonSpan > 0 ? Math.min(1, visibleLonSpan / targetLonSpan) : 1;
    const scaledHeight = metadata ? metadata.imageHeight * scaleFactor : mapHeight;

    return (
        <div style={{ minWidth: 0, overflow: 'hidden', width: '100%' }}>

            {loading && (
                <div className='placeholder-glow'>
                    <span className='placeholder' style={{ height: mapHeight, display: 'block', width: '100%', borderRadius: '10px' }} />
                </div>
            )}

            {!loading && error && <span style={{ fontSize: isMobile ? '14px' : '16px', color: 'grey' }}>{error}</span>}

            {!loading && metadata && zoomData && (
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ marginBottom: '15px', display: 'block' }} className={classes.refineTitle}>
                        {metadata.occurrenceCount >= 0 ? metadata.occurrenceCount.toLocaleString() : '0'} occurrence records
                    </span>

                    <div ref={viewportRef} className='leaflet-touch leaflet-container'
                         style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: '10px',
                             height: `${scaledHeight}px`, maxWidth: `${metadata.imageWidth}px`
                        }}
                         title='Enable interactive map to pan and zoom'>
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                transform: `translateX(-50%) scale(${scaleFactor})`,
                                transformOrigin: 'top center',
                                width: `${metadata.imageWidth}px`,
                                height: `${metadata.imageHeight}px`,
                                backgroundColor: '#e8e8e8',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                userSelect: 'none'
                            }}>
                            {zoomData.layers
                                .filter(layer => !(layer.type === 'occurrences' && !hasOccurrences))
                                .map(layer => (
                                    <img
                                        key={layer.id}
                                        src={layerUrl(encodedGuid, activeZoom, layer)}
                                        alt={layer.label}
                                        draggable={false}
                                        onDragStart={e => e.preventDefault()}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: isLayerVisible(layer) ? 'block' : 'none' }}
                                    />
                                ))}
                        </div>

                        {/* Leaflet-style zoom control — only when >1 zoom option */}
                        {zoomList.length > 1 &&
                            (() => {
                                const currentIdx = zoomList.findIndex(z => z.id === activeZoom);
                                const canZoomIn = currentIdx > 0;
                                const canZoomOut = currentIdx < zoomList.length - 1;
                                return (
                                    <div className='leaflet-top leaflet-left' style={{ position: 'absolute', top: 0, left: 0, zIndex: 11, pointerEvents: 'none' }}>
                                        <div className='leaflet-control-zoom leaflet-bar leaflet-control' style={{ pointerEvents: 'auto' }}>
                                            <a
                                                className={`leaflet-control-zoom-in${canZoomIn ? '' : ' leaflet-disabled'}`}
                                                href='#'
                                                title={canZoomIn ? 'Zoom in' : 'Zoom in. Enable interactive map for closer view'}
                                                role='button'
                                                aria-label='Zoom in'
                                                aria-disabled={!canZoomIn}
                                                onClick={e => {
                                                    e.preventDefault();
                                                    if (canZoomIn) onZoomChange(zoomList[currentIdx - 1].id);
                                                }}>
                                                <span aria-hidden='true'>+</span>
                                            </a>
                                            <a
                                                className={`leaflet-control-zoom-out${canZoomOut ? '' : ' leaflet-disabled'}`}
                                                href='#'
                                                title='Zoom out'
                                                role='button'
                                                aria-label='Zoom out'
                                                aria-disabled={!canZoomOut}
                                                onClick={e => {
                                                    e.preventDefault();
                                                    if (canZoomOut) onZoomChange(zoomList[currentIdx + 1].id);
                                                }}>
                                                <span aria-hidden='true'>−</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })()}

                        {hasOccurrences && showOccurrences && zoomData.layers.some(l => l.id === 'occurrences') && metadata.hexBinValues && (
                            <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 11, pointerEvents: 'none' }}>
                                <Legend fillOpacity={metadata.mapLayerOpacity ?? 0.7} hexBinValues={metadata.hexBinValues} />
                            </div>
                        )}

                        {/* Attribution */}
                        {(() => {
                            const attr = zoomData.attributions;
                            const parts: string[] = [];

                            const visibleBase = zoomData.layers.find(l => l.type === 'base' && isLayerVisible(l));
                            if (visibleBase) {
                                const baseAttr = attr?.baseLayers?.find(b => b.id === visibleBase.id)?.attribution ?? attr?.base;
                                if (baseAttr) parts.push(baseAttr);
                            }

                            if (showOccurrences && zoomData.layers.some(l => l.id === 'occurrences') && attr?.occurrences) {
                                parts.push(attr.occurrences);
                            }

                            attr?.distributions?.forEach(d => {
                                const match = distributions.find(pd => String(pd.geomIdx) === String(d.geomIdx));
                                if (match?.checked !== false && d.text && !parts.includes(d.text)) parts.push(d.text);
                            });

                            if (parts.length === 0) return null;
                            return (
                                <div
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parts.join(' | ')) }}
                                    style={{ position: 'absolute', bottom: '6px', right: '8px', zIndex: 10,
                                        backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: '3px',
                                        padding: '1px 5px', fontSize: '11px', color: '#333', lineHeight: '16px' }}
                                />
                            );
                        })()}

                        <CachedMapControl
                            layers={zoomData.layers}
                            configuredBaseLayers={configuredBaseLayers}
                            activeBaseLayerId={activeBaseLayerId}
                            onBaseLayerChange={setActiveBaseLayerId}
                            showOccurrences={showOccurrences}
                            onToggleOccurrences={onToggleOccurrences}
                            distributions={distributions}
                            onToggleDistribution={onToggleDistribution}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default CachedMapView;
