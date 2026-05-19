/**
 * World-wrap fix for Leaflet-drawn polygons.
 *
 * Ported from wicket-world-wrap-fix.js — splits polygons that cross longitude
 * -180 or +180 into a MULTIPOLYGON WKT so that the search service receives
 * valid, non-wrapping geometry.
 */

import L from 'leaflet';

interface Coord {
    x: number; // longitude
    y: number; // latitude
}

type Ring = Coord[];
type CoordGroup = Ring[];   // a group of rings for one split region
type WrapRings = [CoordGroup, CoordGroup, CoordGroup]; // [< -180, -180..180, > +180]

function isOutOfRange(coords: Ring[]): boolean {
    for (const ring of coords) {
        for (const pt of ring) {
            if (pt.x < -180 || pt.x > 180) return true;
        }
    }
    return false;
}

function addSplitPoint(
    rings: WrapRings,
    edge: L.Point,
    lastPt: L.Point,
    pt: L.Point,
    lastRegion: number,
    region: number,
    slope: number,
    b: number,
    map: L.Map
): void {
    if (edge.x <= Math.max(lastPt.x, pt.x) && edge.x >= Math.min(lastPt.x, pt.x)) {
        const ym = slope * edge.x + b;
        const latlng = map.containerPointToLatLng(new L.Point(edge.x, ym));

        const lastRing = rings[lastRegion + 1][rings[lastRegion + 1].length - 1];
        lastRing.push({ x: latlng.lng, y: latlng.lat });
        // start a new sub-ring when the current one is closed
        if (lastRing[0].x === latlng.lng) {
            rings[lastRegion + 1].push([]);
        }

        const nextRing = rings[region + 1][rings[region + 1].length - 1];
        nextRing.push({ x: latlng.lng, y: latlng.lat });
    }
}

function addWrapPointToRings(
    current: Coord,
    lastPt: L.Point,
    pt: L.Point,
    lastRegion: number,
    region: number,
    rings: WrapRings,
    wrapMinus: L.Point,
    wrapPlus: L.Point,
    map: L.Map
): void {
    if (lastRegion !== -2 && lastRegion !== region) {
        const slope = (pt.y - lastPt.y) / (pt.x - lastPt.x);
        const b = pt.y - pt.x * slope;
        addSplitPoint(rings, wrapMinus, lastPt, pt, lastRegion, region, slope, b, map);
        addSplitPoint(rings, wrapPlus, lastPt, pt, lastRegion, region, slope, b, map);
    }
    rings[region + 1][rings[region + 1].length - 1].push(current);
}

function buildMultiPolygonFromWrapRings(rings: WrapRings): Ring[][] {
    const multipolygon: Ring[][] = [];
    for (let r = 0; r < rings.length; r++) {
        const groups = rings[r];
        for (const coords of groups) {
            const ring: Coord[] = [];
            for (const coord of coords) {
                const c = { ...coord };
                while (c.x < -180) c.x += 360;
                while (c.x > 180) c.x -= 360;
                // correct boundary of > +180 ring
                if (r === 2 && c.x === 180) c.x = -180;
                // correct boundary of < -180 ring
                if (r === 0 && c.x === -180) c.x = 180;
                ring.push(c);
            }
            if (ring.length > 0) {
                // close open rings
                if (ring[0].x !== ring[ring.length - 1].x || ring[0].y !== ring[ring.length - 1].y) {
                    ring.push(ring[0]);
                }
                multipolygon.push([ring]);
            }
        }
    }
    return multipolygon;
}

/**
 * Split a polygon ring (or array of rings) that may cross ±180 longitude into
 * one or more non-wrapping rings.  Returns an array of polygon rings suitable
 * for WKT MULTIPOLYGON serialisation.
 *
 * @param coords  One or more coordinate rings (each ring is Coord[]).
 * @param map     The current Leaflet map instance (used for pixel-space
 *                intersection calculations).
 * @returns       Array of polygon components — each element is an array of
 *                rings (outer boundary only, no holes handled here).
 */
export function wrapCoords(coords: Ring | Ring[], map: L.Map): Ring[][] {
    const rings: Ring[] = Array.isArray(coords[0]) ? (coords as Ring[]) : [coords as Ring];

    if (!isOutOfRange(rings)) {
        return [rings];
    }

    const wrapMinus = map.latLngToContainerPoint(new L.LatLng(-90, -180));
    const wrapPlus = map.latLngToContainerPoint(new L.LatLng(90, 180));

    const wrapRings: WrapRings = [[[]], [[]], [[]]];

    let region = 0;
    let lastRegion = -2;
    let lastPt: L.Point = new L.Point(0, 0);

    for (const ring of rings) {
        for (const coord of ring) {
            const pt = map.latLngToContainerPoint(new L.LatLng(coord.y, coord.x));
            if (pt.x < wrapMinus.x) region = -1;
            else if (pt.x > wrapPlus.x) region = 1;
            else region = 0;

            addWrapPointToRings(coord, lastPt, pt, lastRegion, region, wrapRings, wrapMinus, wrapPlus, map);

            lastRegion = region;
            lastPt = pt;
        }
    }

    return buildMultiPolygonFromWrapRings(wrapRings);
}

/** Round a coordinate value to 6 decimal places for WKT output. */
function r6(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

/**
 * Convert a Leaflet polygon layer to a WKT string, applying world-wrap
 * splitting when the polygon crosses the ±180 meridian.
 *
 * Returns a POLYGON or MULTIPOLYGON WKT string.
 */
export function polygonLayerToWkt(layer: L.Polygon, map: L.Map): string {
    const latlngsRaw = layer.getLatLngs();
    // react-leaflet-draw polygons return [ [LatLng, ...] ] (array of rings)
    const outerRing: L.LatLng[] = (
        Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw
    ) as L.LatLng[];

    const coords: Ring = outerRing.map((ll: L.LatLng) => ({ x: ll.lng, y: ll.lat }));
    // close the ring
    if (coords.length > 0 && (coords[0].x !== coords[coords.length - 1].x || coords[0].y !== coords[coords.length - 1].y)) {
        coords.push(coords[0]);
    }

    const parts = wrapCoords(coords, map);

    if (parts.length === 1) {
        // Simple polygon
        const ring = parts[0][0];
        const ringStr = ring.map(c => `${r6(c.x)} ${r6(c.y)}`).join(', ');
        return `POLYGON((${ringStr}))`;
    } else {
        // Multipolygon
        const polys = parts.map(poly => {
            const ringStrs = poly.map(ring => `(${ring.map(c => `${r6(c.x)} ${r6(c.y)}`).join(', ')})`);
            return `(${ringStrs.join(', ')})`;
        });
        return `MULTIPOLYGON(${polys.join(', ')})`;
    }
}

