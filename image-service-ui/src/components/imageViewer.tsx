/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useEffect, useMemo, useRef, useState} from 'react';
import {MapContainer, useMap} from 'react-leaflet';
import './imageViewer.css';

interface ImageViewerProps {
    apiUrl: string;
    imageId: string;
    width?: number;
    height?: number;
    tileZoomLevels?: number;
    tileSize?: number;
    downloadUrl?: string;
    busy?: boolean;
    onCreateSubimage?: (rect: ImageRectangle) => void;
}

export interface ImageRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Custom Leaflet TMS tile layer matching the exact coordinate math from
 * legacy ALA images-client ala-image-viewer.js.
 *
 * In Leaflet CRS.Simple with bounds [0, 0] to [height/imageScaleFactor, width/imageScaleFactor],
 * latitude coordinates are positive (0 at bottom, height/scaleFactor at top), which produces
 * negative grid coords.y in Leaflet 1.x (coords.y = -1 for bottom tile row, down to -rows for top tile row).
 * ALA image-service stores TMS tiles with y=0 at the bottom row up to (rows - 1) at the top row.
 * Thus: tmsY = -1 - coords.y.
 */
export class AlaTmsTileLayer extends L.TileLayer {
    override getTileUrl(coords: L.Coords): string {
        const z = this._getZoomForUrl();
        const x = coords.x;
        const y = -1 - coords.y;
        const url = (this as unknown as {_url: string})._url;
        return url
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
    }
}

function TileLayerImperative({
    tileUrlTemplate,
    bounds,
    maxNativeZoom
}: {
    tileUrlTemplate: string;
    bounds: L.LatLngBounds;
    maxNativeZoom: number;
}) {
    const map = useMap();

    useEffect(() => {
        const layer = new AlaTmsTileLayer(tileUrlTemplate, {
            bounds,
            noWrap: true,
            minZoom: 0,
            maxZoom: maxNativeZoom + 2,
            maxNativeZoom
        });
        layer.addTo(map);
        map.fitBounds(bounds);
        return () => {
            map.removeLayer(layer);
        };
    }, [map, tileUrlTemplate, bounds, maxNativeZoom]);

    return null;
}

function ViewerToolbar({
    bounds,
    downloadUrl,
    busy,
    imageWidth,
    imageHeight,
    imageScaleFactor,
    onCreateSubimage
}: {
    bounds: L.LatLngBounds;
    downloadUrl?: string;
    busy?: boolean;
    imageWidth: number;
    imageHeight: number;
    imageScaleFactor: number;
    onCreateSubimage?: (rect: ImageRectangle) => void;
}) {
    const map = useMap();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [drawingRectangle, setDrawingRectangle] = useState(false);
    const [hasRectangle, setHasRectangle] = useState(false);
    const [editingRectangle, setEditingRectangle] = useState(false);
    const rectangleRef = useRef<L.Rectangle | null>(null);
    const editHandlesRef = useRef<L.CircleMarker[]>([]);

    function removeEditHandles() {
        editHandlesRef.current.forEach(handle => handle.remove());
        editHandlesRef.current = [];
        setEditingRectangle(false);
    }

    function removeRectangle() {
        removeEditHandles();
        rectangleRef.current?.remove();
        rectangleRef.current = null;
        setHasRectangle(false);
        setDrawingRectangle(false);
    }

    function rectangleInImagePixels(): ImageRectangle | null {
        const rectangle = rectangleRef.current;
        if (!rectangle) return null;
        const selected = rectangle.getBounds();
        const x = Math.max(0, Math.round(selected.getWest() * imageScaleFactor));
        const y = Math.max(0, Math.round(imageHeight - selected.getNorth() * imageScaleFactor));
        const right = Math.min(imageWidth, Math.round(selected.getEast() * imageScaleFactor));
        const bottom = Math.min(imageHeight, Math.round(imageHeight - selected.getSouth() * imageScaleFactor));
        return {x, y, width: right - x, height: bottom - y};
    }

    function toggleRectangleEditing() {
        if (!rectangleRef.current) return;
        if (editingRectangle) {
            removeEditHandles();
            return;
        }

        const rectangle = rectangleRef.current;
        const selected = rectangle.getBounds();
        const corners = [selected.getNorthWest(), selected.getNorthEast(), selected.getSouthEast(), selected.getSouthWest()];
        const oppositeCorner = [2, 3, 0, 1];
        editHandlesRef.current = corners.map((corner, index) => {
            const handle = L.circleMarker(corner, {
                radius: 6,
                color: '#fff',
                weight: 2,
                fillColor: '#2463eb',
                fillOpacity: 1,
                bubblingMouseEvents: false
            }).addTo(map);
            let dragging = false;
            handle.on('mousedown', event => {
                L.DomEvent.stop(event.originalEvent);
                dragging = true;
                map.dragging.disable();
            });
            map.on('mousemove', event => {
                if (!dragging) return;
                handle.setLatLng(event.latlng);
                const fixed = editHandlesRef.current[oppositeCorner[index]].getLatLng();
                rectangle.setBounds(L.latLngBounds(fixed, event.latlng));
                const updated = rectangle.getBounds();
                const nextCorners = [updated.getNorthWest(), updated.getNorthEast(), updated.getSouthEast(), updated.getSouthWest()];
                editHandlesRef.current.forEach((other, otherIndex) => {
                    if (otherIndex !== index) other.setLatLng(nextCorners[otherIndex]);
                });
            });
            const finish = () => {
                if (!dragging) return;
                dragging = false;
                map.dragging.enable();
            };
            map.on('mouseup', finish);
            window.addEventListener('mouseup', finish);
            return handle;
        });
        setEditingRectangle(true);
    }

    useEffect(() => {
        if (!drawingRectangle) return;
        const container = map.getContainer();
        let start: L.LatLng | null = null;

        const pointFromEvent = (event: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            return map.containerPointToLatLng(L.point(event.clientX - rect.left, event.clientY - rect.top));
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            event.preventDefault();
            start = pointFromEvent(event);
            // Do not call removeRectangle() here: it exits drawing mode and
            // tears down these pointer listeners before the drag can finish.
            removeEditHandles();
            rectangleRef.current?.remove();
            rectangleRef.current = null;
            setHasRectangle(false);
            container.setPointerCapture?.(event.pointerId);
            rectangleRef.current = L.rectangle(L.latLngBounds(start, start), {
                color: 'blue',
                weight: 1,
                fillColor: '#2463eb',
                fillOpacity: .12
            }).addTo(map);
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!start || !rectangleRef.current) return;
            rectangleRef.current.setBounds(L.latLngBounds(start, pointFromEvent(event)));
        };
        const onPointerUp = (event: PointerEvent) => {
            if (!start) return;
            start = null;
            if (container.hasPointerCapture?.(event.pointerId)) {
                container.releasePointerCapture(event.pointerId);
            }
            setHasRectangle(true);
            setDrawingRectangle(false);
        };

        map.dragging.disable();
        container.classList.add('image-viewer-map--drawing');
        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            map.dragging.enable();
            container.classList.remove('image-viewer-map--drawing');
            container.removeEventListener('pointerdown', onPointerDown);
            container.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [drawingRectangle, map]);

    useEffect(() => () => {
        editHandlesRef.current.forEach(handle => handle.remove());
        rectangleRef.current?.remove();
    }, []);

    async function toggleFullscreen() {
        const container = map.getContainer().closest('.image-viewer-wrapper') as HTMLElement | null;
        if (!container) return;
        if (document.fullscreenElement) await document.exitFullscreen();
        else await container.requestFullscreen();
        setTimeout(() => map.invalidateSize(), 50);
    }

    return (
        <div className="image-viewer-toolbar" role="toolbar" aria-label="Image viewer controls" data-testid="image-viewer-toolbar">
            <div className="image-viewer-toolbar__group">
                <button type="button" title="Fit image" aria-label="Fit image" onClick={() => map.fitBounds(bounds)}>
                    <i className="bi bi-arrows" aria-hidden="true"/>
                </button>
                <button type="button" title="Image settings" aria-label="Image settings" onClick={() => setSettingsOpen(v => !v)} aria-pressed={settingsOpen}>
                    <i className="bi bi-sliders" aria-hidden="true"/>
                </button>
            </div>

            <div className="image-viewer-toolbar__group">
                <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => map.zoomIn()}><i className="bi bi-plus-lg" aria-hidden="true"/></button>
                <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => map.zoomOut()}><i className="bi bi-dash-lg" aria-hidden="true"/></button>
                <button type="button" title="Full screen" aria-label="Full screen" onClick={toggleFullscreen}><i className="bi bi-arrows-fullscreen" aria-hidden="true"/></button>
            </div>

            {downloadUrl && (
                <a className="image-viewer-toolbar__single" href={downloadUrl} title="Download original" aria-label="Download original">
                    <i className="bi bi-download" aria-hidden="true"/>
                </a>
            )}

            <button
                type="button"
                className="image-viewer-toolbar__single"
                title="Draw rectangle"
                aria-label="Draw rectangle"
                aria-pressed={drawingRectangle}
                onClick={() => setDrawingRectangle(value => !value)}
            >
                <i className="bi bi-bounding-box" aria-hidden="true"/>
            </button>

            <div className="image-viewer-toolbar__group">
                <button type="button" title={hasRectangle ? 'Edit selected rectangle' : 'Draw a rectangle to edit'} aria-label="Edit selected rectangle" aria-pressed={editingRectangle} disabled={!hasRectangle || busy} onClick={toggleRectangleEditing}>
                    <i className="bi bi-pencil-square" aria-hidden="true"/>
                </button>
                <button type="button" title={hasRectangle ? 'Remove selected rectangle' : 'Draw a rectangle to remove'} aria-label="Remove selected rectangle" disabled={!hasRectangle || busy} onClick={removeRectangle}>
                    <i className="bi bi-trash" aria-hidden="true"/>
                </button>
                <button
                    type="button"
                    title={hasRectangle ? 'Create a sub-image from the selected rectangle' : 'Draw a rectangle to create a sub-image'}
                    aria-label="Create sub-image"
                    disabled={!hasRectangle || busy}
                    onClick={() => {
                        const rect = rectangleInImagePixels();
                        if (rect && rect.width > 0 && rect.height > 0) onCreateSubimage?.(rect);
                    }}
                >
                    <i className="bi bi-image" aria-hidden="true"/>
                </button>
            </div>

            {settingsOpen && (
                <div className="image-viewer-toolbar__popover">
                    <strong>Viewer settings</strong>
                    <button type="button" onClick={() => map.fitBounds(bounds)}>Reset zoom and position</button>
                </div>
            )}
        </div>
    );
}

/**
 * Zoomable/pannable image tile viewer built on Leaflet CRS.Simple using exact legacy ALA coordinate math.
 * Tiles are requested from:
 *   /image/:imageId/tms/{z}/{x}/{y}.png
 */
export default function ImageViewer({
    apiUrl,
    imageId,
    width = 1000,
    height = 1000,
    tileZoomLevels,
    tileSize = 256,
    downloadUrl,
    busy,
    onCreateSubimage
}: ImageViewerProps) {
    const maxNativeZoom = useMemo(() => {
        if (typeof tileZoomLevels === 'number' && tileZoomLevels > 0) {
            return tileZoomLevels - 1;
        }
        return Math.max(0, Math.ceil(Math.log2(Math.max(width, height, 1) / tileSize)));
    }, [tileZoomLevels, width, height, tileSize]);

    const {bounds, center} = useMemo(() => {
        const imageScaleFactor = Math.pow(2, maxNativeZoom);
        const centerx = width / 2 / imageScaleFactor;
        const centery = height / 2 / imageScaleFactor;
        const p1 = L.latLng(height / imageScaleFactor, 0);
        const p2 = L.latLng(0, width / imageScaleFactor);
        const b = L.latLngBounds(p1, p2);
        const c = L.latLng(centery, centerx);
        return {bounds: b, center: c};
    }, [width, height, maxNativeZoom]);

    const tileUrlTemplate = `${apiUrl}/image/${encodeURIComponent(imageId)}/tms/{z}/{x}/{y}.png`;

    return (
        <div data-testid="image-viewer-map" className="image-viewer-wrapper">
            <MapContainer
                className="image-viewer-map"
                crs={L.CRS.Simple}
                bounds={bounds}
                center={center}
                minZoom={0}
                maxZoom={maxNativeZoom + 2}
                attributionControl={false}
                zoomControl={false}
            >
                <TileLayerImperative
                    tileUrlTemplate={tileUrlTemplate}
                    bounds={bounds}
                    maxNativeZoom={maxNativeZoom}
                />
                <ViewerToolbar
                    bounds={bounds}
                    downloadUrl={downloadUrl}
                    busy={busy}
                    imageWidth={width}
                    imageHeight={height}
                    imageScaleFactor={Math.pow(2, maxNativeZoom)}
                    onCreateSubimage={onCreateSubimage}
                />
            </MapContainer>
        </div>
    );
}
