/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import { faDownload, faMapMarker } from '@fortawesome/free-solid-svg-icons';
import {faSpinner} from "@fortawesome/free-solid-svg-icons/faSpinner";
import ReactDOM from "react-dom/client";
import {FormattedMessage, IntlShape, useIntl} from "react-intl";
import { FeatureGroup, LayersControl, MapContainer, TileLayer, WMSTileLayer, useMapEvents, useMap, ScaleControl } from 'react-leaflet';
import {EditControl} from "react-leaflet-draw";
import "react-leaflet-fullscreen/styles.css";

import 'leaflet/dist/leaflet.css';
import L, { LatLng, LeafletMouseEvent } from 'leaflet';
import {useEffect, useRef, useState} from "react";
import ReactLeafletGoogleLayer from "react-leaflet-google-layer";
import { DataQualityInfo } from '../api/model.tsx';
import MapLayerControls from "./mapLayerControls.tsx";
import defaultMapFacets from "../config/defaultMapFacets.json";
import MapLegendControls from "./mapLegendControls.tsx";
import TopRightControl from "./TopRightControl.tsx";
import { polygonLayerToWkt } from '../util/worldWrapFix.ts';
import DownloadMapModal from './downloadMapModal.tsx';

const org = import.meta.env.VITE_MAP_ORG;
const center = new LatLng(
    Number(import.meta.env.VITE_MAP_CENTRE_LAT),
    Number(import.meta.env.VITE_MAP_CENTRE_LNG)
);
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);
const defaultOpacity = Number(import.meta.env.VITE_MAP_DEFAULT_OPACITY);
const defaultPointSize = Number(import.meta.env.VITE_MAP_DEFAULT_POINT_SIZE);
const defaultColour = import.meta.env.VITE_MAP_DEFAULT_COLOUR;

/**
 * Haversine great-circle distance between two lat/lng points, in kilometres.
 */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    let dLngDeg = (lng2 - lng1);
    // Normalise to shortest arc: wrap to [-180, +180]
    dLngDeg = ((dLngDeg + 180) % 360 + 360) % 360 - 180;
    const dLng = dLngDeg * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapClickHandler({ onClick, isDrawingRef }: { onClick: (e: LeafletMouseEvent) => void; isDrawingRef: React.MutableRefObject<boolean> }) {
    const clickCountRef = useRef(0);
    useMapEvents({
        click: (e) => {
            if (isDrawingRef.current) return;
            clickCountRef.current += 1;
            if (clickCountRef.current === 1) {
                setTimeout(() => {
                    if (clickCountRef.current === 1) {
                        onClick(e);
                    }
                    clickCountRef.current = 0;
                }, 400);
            }
        },
        dblclick: () => {
            // reset immediately on dblclick so the delayed single-click callback
            // sees count > 1 and skips the point lookup
            clickCountRef.current = 2;
        }
    });
    return null;
}

interface MapViewProps {
    queryString?: string,
    dataQualityInfo?: DataQualityInfo,
    tab?: string
}

function MapView({ queryString, tab }: MapViewProps) {
    const [opacity, setOpacity] = useState<number>(defaultOpacity);
    const [pointSize, setPointSize] = useState<number>(defaultPointSize);
    const [colourBy, setColourBy] = useState<string>('-1'); // default to the default color, not grids for facets
    const [outline, setOutline] = useState<boolean>(false);
    const [showOccurrences, setShowOccurrences] = useState<boolean>(true);
    const [hiddenFacets, setHiddenFacets] = useState<number[]>([]);
    const [legendFacets, setLegendFacets] = useState<any[]>([]);
    const isDrawingRef = useRef<boolean>(false);

    const [showDownloadMap, setShowDownloadMap] = useState<boolean>(false);

    // wkt from query string
    const [queryWkt, setQueryWkt] = useState<string | null>(() => {
        const qs = new URLSearchParams(queryString?.startsWith('?') ? queryString.slice(1) : queryString ?? '');
        return qs.get('wkt');
    });

    useEffect(() => {
        const qs = new URLSearchParams(queryString?.startsWith('?') ? queryString.slice(1) : queryString ?? '');
        setQueryWkt(qs.get('wkt'));
    }, [queryString]);

    // map popup state
    const [mapLookupLatLng, setMapLookupLatLng] = useState<LatLng | null>(null);
    const [mapLookupQueryParams, setMapLookupQueryParams] = useState<string>('');
    const [mapLookupInProgress, setMapLookupInProgress] = useState(false);
    const [mapLookupOccurrences, setMapLookupOccurrences] = useState<any[]>([]);
    // const [mapLookupCount, setMapLookupCount] = useState<number>(0);
    const [mapLookupOccurrence, setMapLookupOccurrence] = useState<any | undefined>(undefined);
    const [mapLookupItemIdx, setMapLookupItemIdx] = useState<number>(0);
    const popupContainerRef = useRef<HTMLDivElement | null>(null);
    const popupRootRef = useRef<ReactDOM.Root | null>(null);
    const popupRef = useRef<L.Popup | null>(null);

    const mapRef = useRef<L.Map | null>(null);
    const initialLayerRef = useRef<L.Layer | null>(null);
    const worldCopyLayersRef = useRef<L.Layer[]>([]);
    const intl: IntlShape = useIntl();

    // Render popup content when mapLookupOccurrence changes
    useEffect(() => {
        if (!mapLookupOccurrence || !mapRef.current || !mapLookupLatLng) return;

        if (!popupRootRef.current) {
            const container = document.createElement("div");
            popupContainerRef.current = container;
            popupRef.current = L.popup({
                maxWidth: 300,
                minWidth: 300,
                autoPan: true // This is not working as expected, sometimes it does not pan
            }).setLatLng(mapLookupLatLng).setContent(container).openOn(mapRef.current);
            popupRootRef.current = ReactDOM.createRoot(container);
        }

        // update popup
        popupRootRef.current.render(popupDiv());

        // attempt to move into view
        if (mapRef.current && popupRef.current) {
            // I close and re-open the popup to force it to resize and pan the map so that it is fully visible
            mapRef.current.closePopup(popupRef.current);
            popupRef.current.openOn(mapRef.current);
        }
    }, [mapLookupOccurrence]);

    useEffect(() => {
        if (mapLookupOccurrences && mapLookupOccurrences.length > 0) {
            fetchOccurrence(0);
        }
    }, [mapLookupOccurrences]);

    useEffect(() => {
        if (tab === 'map') {
            setTimeout(() => {
                mapRef.current?.invalidateSize(false);
            }, 300); // Adjust timeout to tab transition
        }
    }, [tab]);

    function buildSpatialUrl(): string {
        let baseUrl = import.meta.env.VITE_APP_SPATIAL_PORTAL_URL || 'https://spatial.ala.org.au';
        let url = new URL(baseUrl);

        // add query params
        if (queryString) {
            let params = new URLSearchParams(queryString);
            params.forEach((value, key) => {
                url.searchParams.append(key, value);
            });
        }
        return url.toString();
    }

    function onCreated(e: any) {
        const layer = e.layer;

        layer.on('click', (event: LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event);
            onFeatureClick(layer, event);
        });
    }

    function nextOccurrence() {
        setMapLookupItemIdx(mapLookupItemIdx + 1);
        fetchOccurrence(mapLookupItemIdx + 1);
    }

    function prevOccurrence() {
        setMapLookupItemIdx(mapLookupItemIdx - 1);
        fetchOccurrence(mapLookupItemIdx - 1);
    }

    function fetchOccurrence(idx: number) {
        if (mapLookupOccurrences.length > idx) {
            const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrence/${mapLookupOccurrences[idx]}`;
            fetch(url, {
                method: 'GET'
            }).then(response => response.json()).then((data) => {
                setMapLookupOccurrence(data);
            });
        }
    }

    function popupDiv() {
        if (!mapLookupLatLng) {
            return <div style={{width: "300px", height: "250px"}}>{intl.formatMessage({id:"facets.multiplefacets.tabletr01td01", defaultMessage:"loading..."})}</div>;
        }

        const viewing = intl.formatMessage({id: 'search.map.viewing', defaultMessage: 'Viewing'});
        const of = intl.formatMessage({id: 'search.map.of', defaultMessage: 'of'});
        const viewAll = intl.formatMessage({id: 'search.map.viewAllRecords', defaultMessage: 'view all records'});
        const occurrences = intl.formatMessage({id: 'search.map.occurrences', defaultMessage: 'occurrences'});
        const prev = intl.formatMessage({id: 'search.map.popup.prev', defaultMessage: '&lt; Prev'});
        const next = intl.formatMessage({id: 'search.map.popup.next', defaultMessage: 'Next &gt;'});
        const viewRecord = intl.formatMessage({id: 'search.map.popup.viewRecord', defaultMessage: 'View record'});

        // record labels
        const catalogNumberLabel = intl.formatMessage({id: 'record.catalogNumber.label'});
        const recordNumberLabel = intl.formatMessage({id: 'record.recordNumber.label'});
        const recordFieldNumberLabel = intl.formatMessage({id: 'record.fieldNumber.label'});
        const recordInstitutionNameLabel = intl.formatMessage({id: 'record.institutionName.label'});
        const recordDataResourceNameLabel = intl.formatMessage({id: 'record.dataResourceName.label'});
        const recordCollectionNameLabel = intl.formatMessage({id: 'record.collectionName.label'});
        const recordRecordedByLabel = intl.formatMessage({id: 'record.recordedBy.label'});
        const recordEventDateLabel = intl.formatMessage({id: 'record.eventDate.label'});
        const loading = intl.formatMessage({id: "facets.multiplefacets.tabletr01td01", defaultMessage:"loading..."});

        return (
            <div style={{ width: '300px', wordBreak: 'break-word' }}>
                <strong>
                    {viewing} {mapLookupItemIdx + 1} {of} {mapLookupOccurrences.length} {occurrences}
                </strong>
                <a style={{ paddingLeft: '20px', color: '#c44d34' }} href={'/occurrences/search' + queryString + '&' + mapLookupQueryParams}>
                    {viewAll}
                </a>
                <br />

                {mapLookupOccurrence?.raw?.occurrence?.catalogNumber && (
                    <>{catalogNumberLabel}: {mapLookupOccurrence.raw.occurrence.catalogNumber}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.catalogNumber && mapLookupOccurrence?.processed?.occurrence?.catalogNumber && (
                    <>{catalogNumberLabel}: {mapLookupOccurrence.processed.occurrence.catalogNumber}<br /></>)}
                {mapLookupOccurrence?.raw?.occurrence?.recordNumber && (
                    <>{recordNumberLabel}: {mapLookupOccurrence.raw.occurrence.recordNumber}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.recordNumber && mapLookupOccurrence?.raw?.occurrence?.fieldNumber && (
                    <>{recordFieldNumberLabel}: {mapLookupOccurrence.raw.occurrence.fieldNumber}<br /></>)}
                {mapLookupOccurrence?.processed?.attribution?.institutionName && (
                    <>{recordInstitutionNameLabel}: {mapLookupOccurrence.processed.attribution.institutionName}<br /></>)}
                {!mapLookupOccurrence?.processed?.attribution?.institutionName && mapLookupOccurrence?.processed?.attribution?.dataResourceName && (
                    <>{recordDataResourceNameLabel}: {mapLookupOccurrence.processed.attribution.dataResourceName}<br /></>)}
                {mapLookupOccurrence?.processed?.attribution?.collectionName && (
                    <>{recordCollectionNameLabel}: {mapLookupOccurrence.processed.attribution.collectionName}<br /></>)}
                {mapLookupOccurrence?.raw?.classification?.vernacularName && (
                    <>{mapLookupOccurrence.raw.classification.vernacularName}<br /></>)}
                {!mapLookupOccurrence?.raw?.classification?.vernacularName && mapLookupOccurrence?.processed?.classification?.vernacularName && (
                    <>{mapLookupOccurrence.processed.classification.vernacularName}<br /></>)}
                {mapLookupOccurrence?.processed?.classification?.scientificName && (
                    <>{mapLookupOccurrence?.processed?.classification?.taxonRankID && mapLookupOccurrence?.processed?.classification?.taxonRankID >= 6000 ? <i>{mapLookupOccurrence.processed.classification.scientificName}</i> : <>{mapLookupOccurrence.processed.classification.scientificName}</>}<br /></>)}
                {!mapLookupOccurrence?.processed?.classification?.scientificName && mapLookupOccurrence?.raw?.classification?.scientificName && (
                    <>{mapLookupOccurrence.raw.classification.scientificName}<br /></>)}
                {mapLookupOccurrence?.raw?.occurrence?.recordedBy && (
                    <>{recordRecordedByLabel}: {mapLookupOccurrence.raw.occurrence.recordedBy}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.recordedBy && mapLookupOccurrence?.processed?.occurrence?.recordedBy && (
                    <>{recordRecordedByLabel}: {mapLookupOccurrence.processed.occurrence.recordedBy}<br /></>)}
                {mapLookupOccurrence?.processed?.event?.eventDate && (
                    <>{recordEventDateLabel}: {mapLookupOccurrence.processed.event.eventDate}<br /></>)}

                <br />
                {mapLookupOccurrence == undefined && <>{loading}</>}
                <div className={'d-flex'}>
                    <a className='btn btn-sm btn-outline-dark'
                       style={{
                           fontSize: '12px',
                           lineHeight: '14px',
                           paddingTop: '2px',
                           textDecoration: 'none',
                           color: '#000'
                       }}

                       href={'/occurrence/' + mapLookupOccurrence?.processed?.uuid}>
                        {viewRecord}
                    </a>
                    <button className='btn btn-sm btn-outline-dark ms-auto' style={{ fontSize: '12px', lineHeight: '14px', paddingTop: '2px' }} onClick={mapLookupItemIdx > 0 ? prevOccurrence : undefined} disabled={mapLookupItemIdx === 0 || mapLookupOccurrences.length <= 1}
                            dangerouslySetInnerHTML={{ __html: prev }}>
                    </button>
                    <button
                        className='btn btn-sm btn-outline-dark ms-1'
                        style={{ fontSize: '12px', lineHeight: '14px', paddingTop: '2px' }}
                        onClick={mapLookupItemIdx < mapLookupOccurrences.length - 1 ? nextOccurrence : undefined}
                        disabled={mapLookupItemIdx === mapLookupOccurrences.length - 1 || mapLookupOccurrences.length <= 1}
                        dangerouslySetInnerHTML={{ __html: next }}>
                    </button>
                </div>
            </div>
        );
    }

    async function onFeatureClick(layer: any, e: LeafletMouseEvent) {
        // 1. Get area terms from the layer (wkt=... or radius=...&lat=...&lon=...)
        const areaTerms = getTermsFromLayer(layer);

        // 2. Strip existing spatial params from the current queryString, then append the new area
        const baseQs = (queryString ?? '').replace(/^[?]/, '');
        const stripped = baseQs.replace(/(^|&)(wkt|lat|lon|radius)=[^&]*/g, '').replace(/^&+/, '');
        const fullTerms = stripped ? `${stripped}&${areaTerms}` : areaTerms;

        const uniqueId = Date.now(); // Simple unique ID for this popup instance

        // 3. Set popup content
        const div = document.createElement('div');
        div.innerHTML = `
            <div>${intl.formatMessage({ id: 'advancedsearch.js.map.common.speciescount' })}: <span id="taxonCount${uniqueId}" class="fw-bold">calculating...</div>
            <div>${intl.formatMessage({ id: 'advancedsearch.js.map.common.occurrencecount' })}: <span id="occurrenceCount${uniqueId}" class="fw-bold">calculating...</span></div>
            <a href="/occurrences/search?${fullTerms}" style="color: #C44D34 !important;">${intl.formatMessage({ id: 'search.map.popup.linkText' })}</a><br/>
            <a href="#" id="remove-area-btn" style="color: #C44D34 !important;">${intl.formatMessage({ id: 'search.map.popup.removeText' })}</a>
        `;

        // Attach event handler
        div.querySelector('#remove-area-btn')?.addEventListener('click', () => {
            mapRef.current?.removeLayer(layer);
            mapRef.current?.closePopup();
        });

        L.popup().setLatLng(e.latlng).setContent(div).openOn(mapRef.current!);

        // 4. Fetch counts using the full combined query
        const resp1 = await fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?${fullTerms}&facet=false&pageSize=0`);
        const data1 = await resp1.json();
        const occurrenceCount = data1.totalRecords;
        div.querySelector('#occurrenceCount' + uniqueId)!.textContent = occurrenceCount.toString();

        const resp2 = await fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/facets?${fullTerms}&facets=scientificName`);
        const data2 = await resp2.json();
        const taxonCount = data2[0].count;
        div.querySelector('#taxonCount' + uniqueId)!.textContent = taxonCount.toString();
    }

    function getTermsFromLayer(layer: any): string {
        if (layer instanceof L.Circle) {
            const center = layer.getLatLng();
            const radius = layer.getRadius() / 1000;
            return `radius=${radius}&lat=${center.lat}&lon=${center.lng}`;
        } else if (layer instanceof L.Polygon) {
            const wkt = mapRef.current ? polygonLayerToWkt(layer, mapRef.current) : '';
            return `wkt=${encodeURIComponent(wkt)}`;
        }
        return '';
    }

    // build the WMS URL for the current state
    function getAlaWmsUrl() {
        let style = '';
        let extra = '';
        if (colourBy === '-1') {
            style = `color%3A${defaultColour}`;
        } else if (colourBy === 'grid') {
            style = 'colormode:grid';
            let sz = 2 ** (9 - Math.max(pointSize, 2));
            extra = '&GRIDDETAIL=' + sz;
        } else {
            style = 'colormode%3A' + colourBy;
        }

        if (hiddenFacets.length > 0) {
            // &HQ=1&HQ=2...
            extra += hiddenFacets.map(facet => `&HQ=${encodeURIComponent(facet)}`).join('');
        }

        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect${queryString}&ENV=${style}%3Bname%3Acircle%3Bsize%3A${pointSize}%3Bopacity%3A1&OUTLINE=${outline}${extra}`;
    }

    function getLegendImgUrl() {
        if (colourBy === 'grid') {
            return `${import.meta.env.VITE_APP_BIOCACHE_URL}/density/legend${queryString}`;
        }

        return undefined;
    }

    function mapClick(e: LeafletMouseEvent) {
        if (!queryString) {
            return;
        }

        const wrappedLng = ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180;

        // test if the clicked point is inside of the query parameter lat/lon/radius
        const qs = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString);
        const filterLat = qs.get('lat');
        const filterLon = qs.get('lon');
        const filterRadius = qs.get('radius'); // km
        if (filterLat && filterLon && filterRadius) {
            const distKm = distanceKm(e.latlng.lat, wrappedLng, parseFloat(filterLat), parseFloat(filterLon));
            if (distKm > parseFloat(filterRadius)) {
                return; // click is outside the existing spatial filter — skip lookup
            }
        }

        setMapLookupInProgress(true);
        if (popupRef.current) {
            mapRef.current?.closePopup(popupRef.current);
            popupRef.current = null;
            if (popupRootRef.current) popupRootRef.current = null;
        }

        let pointSize = 5;
        let zoomLevel = mapRef.current ? mapRef.current.getZoom() : defaultZoom;
        let c = 400; // base difference circumference in meters
        var radius = c / Math.pow(2, zoomLevel);

        // Adjust radius based on size, legacy calculation
        if (pointSize >= 5 && pointSize < 8) {
            radius *= 2;
        }
        if (pointSize >= 8) {
            radius *= 3;
        }

        // Strip existing lat/lon/radius spatial params, then rebuild a clean query string.
        const stripped = queryString.replace(/[&?](lat|lon|radius)=[^&]*/g, '');
        const cleanedQuery = stripped.replace(/^[&?]+/, '');
        const pointParams = `lon=${wrappedLng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`;
        const infoQs = cleanedQuery ? `?${cleanedQuery}&${pointParams}` : `?${pointParams}`;

        // biocache query for this location — always use wrapped longitude (±180)
        setMapLookupQueryParams(`&lon=${wrappedLng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`);
        setMapLookupLatLng(e.latlng);
        setMapLookupOccurrence(undefined);
        setMapLookupItemIdx(0);
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/info${infoQs}`;
        fetch(url, {
            method: 'GET'
        }).then(response => response.json()).then((data) => {

            //setMapLookupCount(data.count);
            setMapLookupOccurrences(data.occurrences);

            if (!mapRef.current) {
                return;
            }

            if (data.count == 0) {
                return;
            }
        }).finally(() => {
            setMapLookupInProgress(false);
        })
    }

    function handleColourChange(colourBy: string) {
        setColourBy(colourBy || '-1');
        setShowOccurrences(false);
        setTimeout(() => {
            setShowOccurrences(true);
        }, 5);

        if (colourBy === 'grid' || colourBy === '-1') {
            setHiddenFacets([]);
            setLegendFacets([]);
        } else {
            let url = new URL(import.meta.env.VITE_APP_BIOCACHE_URL + '/mapping/legend' + queryString + "&cm=" + encodeURIComponent(colourBy));
            fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    let facets: any[] = [];
                    for (let item of data) {
                        facets.push(item);
                    }
                    setHiddenFacets([]);
                    setLegendFacets(facets);
                });
        }
    }

    function handleSizeChange(sizeBy: number) {
        setPointSize(sizeBy);
        setShowOccurrences(false);
        updateWMSlayer();
    }

    function handleOpacityChange(opacity: number) {
        setOpacity(opacity);
    }

    function handleOutlineChange(outline: boolean) {
        setOutline(outline);
        updateWMSlayer();
    }

    function setHiddenFacetsHandler(facets: number[]) {
        setHiddenFacets(facets);
        updateWMSlayer();
    }

    function updateWMSlayer() {
        setShowOccurrences(false);
        setTimeout(() => {
            setShowOccurrences(true);
        }, 5);
    }

    // Add the query defined area to the map
    function InitialLayerLoader() {
        const map = useMap();
        useEffect(() => {
            if (initialLayerRef.current || !queryString) return;

            const qs = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString);
            const lat = qs.get('lat');
            const lon = qs.get('lon');
            const radius = qs.get('radius');
            const wkt = qs.get('wkt');

            let layer: L.Layer | null = null;

            if (lat && lon && radius) {
                layer = L.circle([parseFloat(lat), parseFloat(lon)], {
                    radius: parseFloat(radius) * 1000, // km → metres
                    color: '#bada55',
                    fillOpacity: 0.1
                });
            } else if (wkt) {
                const parsePairs = (s: string): L.LatLngTuple[] =>
                    s.trim().split(',').map(pair => {
                        const parts = pair.trim().split(/\s+/);
                        return [parseFloat(parts[1]), parseFloat(parts[0])] as L.LatLngTuple;
                    }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

                const ringContents = [...wkt.matchAll(/\(([^()]+)\)/g)].map(m => m[1]);

                if (/^POLYGON/i.test(wkt) && ringContents.length > 0) {
                    layer = L.polygon(parsePairs(ringContents[0]), { color: '#bada55', fillOpacity: 0.1 });
                } else if (/^MULTIPOLYGON/i.test(wkt) && ringContents.length > 0) {
                    const latlngsArr = ringContents.map(r => parsePairs(r));
                    layer = L.polygon(latlngsArr, { color: '#bada55', fillOpacity: 0.1 });
                }
            }

            if (!layer) return;

            layer.addTo(map);
            initialLayerRef.current = layer;
            layer.on('click', (event: L.LeafletMouseEvent) => {
                L.DomEvent.stopPropagation(event);
                onFeatureClick(layer!, event);
            });

            // add duplicate objects so they appear everywhere when zoomed out
            const shiftLatlngs = (lls: any, offset: number): any =>
                Array.isArray(lls[0])
                    ? lls.map((inner: any) => shiftLatlngs(inner, offset))
                    : (lls as L.LatLng[]).map((ll: L.LatLng) => new L.LatLng(ll.lat, ll.lng + offset));

            const addWorldCopy = (offsetDeg: number) => {
                let copy: L.Layer | null = null;
                if (layer instanceof L.Circle) {
                    const c = (layer as L.Circle).getLatLng();
                    copy = L.circle([c.lat, c.lng + offsetDeg],
                        { radius: (layer as L.Circle).getRadius(), color: '#bada55', fillOpacity: 0.1, interactive: false });
                } else if (layer instanceof L.Polygon) {
                    const lls = (layer as L.Polygon).getLatLngs();
                    copy = L.polygon(shiftLatlngs(lls, offsetDeg),
                        { color: '#bada55', fillOpacity: 0.1, interactive: false });
                }
                if (copy) {
                    copy.addTo(map);
                    worldCopyLayersRef.current.push(copy);
                }
            };
            addWorldCopy(-360);
            addWorldCopy(360);
        }, []);

        return null;
    }

    return (
        <>
            <div>
                <a className='btn btn-outline-dark btn-sm tooltips me-1' style={{ textDecoration: 'none' }} href={buildSpatialUrl()} title={intl.formatMessage({ id: 'map.spatialportal.btn.title.param' }, { 0: org })}>
                    <FontAwesomeIconLite icon={faMapMarker} />
                    &nbsp;&nbsp;
                    <FormattedMessage id='map.spatialportal.btn.label' defaultMessage='View in spatial portal' />
                </a>

                <a className='btn btn-outline-dark btn-sm tooltips' style={{ textDecoration: 'none' }} onClick={() => setShowDownloadMap(true)} title={intl.formatMessage({ id: 'map.downloadmaps.btn.title' })}>
                    <FontAwesomeIconLite icon={faDownload} />
                    &nbsp;&nbsp;
                    <FormattedMessage id='map.downloadmaps.btn.label' defaultMessage='Download map' />
                </a>

                {showDownloadMap && (
                    <DownloadMapModal
                        onClose={() => setShowDownloadMap(false)}
                        queryString={queryString}
                        mapRef={mapRef}
                    />
                )}

                {queryWkt && (
                    <a className='btn btn-outline-dark btn-sm tooltips ms-1' style={{ textDecoration: 'none' }}
                       href={`data:text/plain;charset=utf-8,${encodeURIComponent(queryWkt)}`} download='polygon.wkt'
                       title={intl.formatMessage({ id: 'map.downloadwkt.btn.title', defaultMessage: 'Download the spatial area as a WKT file' })}>
                        <FontAwesomeIconLite icon={faDownload} />
                        &nbsp;&nbsp;
                        <FormattedMessage id='map.downloadwkt.btn.label' defaultMessage='Download WKT' />
                    </a>
                )}

                <div style={{ marginBottom: '10px' }}></div>
                {mapLookupInProgress && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <FontAwesomeIconLite icon={faSpinner} spin style={{fontSize: 64, color: '#999'}}/>
                    </div>
                )}
                <MapContainer ref={mapRef} center={center} zoom={defaultZoom} scrollWheelZoom={false} worldCopyJump={true} style={{ height: '655px', borderRadius: '10px', cursor: 'pointer' }}>
                    <ScaleControl position='bottomright' imperial={false} />
                    <TopRightControl className={'map-layer-control'}>
                        <MapLayerControls
                            facets={defaultMapFacets}
                            defaultColourBy={colourBy}
                            defaultSize={pointSize}
                            defaultOpacity={opacity}
                            defaultOutline={outline}
                            onColourChange={handleColourChange}
                            onSizeChange={handleSizeChange}
                            onOpacityChange={handleOpacityChange}
                            onOutlineChange={handleOutlineChange}
                        />
                    </TopRightControl>
                    <TopRightControl className={'map-legend-control'}>
                        <MapLegendControls setHiddenFacets={setHiddenFacetsHandler} legendUrl={getLegendImgUrl()} facets={legendFacets} colourBy={colourBy}/>
                    </TopRightControl>

                    {!import.meta.env.VITE_GOOGLE_MAP_API_KEY && <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />}
                    {import.meta.env.VITE_GOOGLE_MAP_API_KEY && (
                        <LayersControl position='topright'>
                            <LayersControl.BaseLayer checked name='Minimal'>
                                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name='Road'>
                                <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'roadmap'} />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name='Terrain'>
                                <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'terrain'} />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name='Satellite'>
                                <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'satellite'} />
                            </LayersControl.BaseLayer>
                        </LayersControl>
                    )}

                    {/* Handle map click events — disabled while a draw tool is active */}
                    <MapClickHandler onClick={mapClick} isDrawingRef={isDrawingRef} />

                    {/* Draw initial spatial filter from query params */}
                    <InitialLayerLoader />

                    {showOccurrences && queryString !== undefined &&
                        <WMSTileLayer url={getAlaWmsUrl()} layers='ALA:occurrences' format='image/png' transparent={true} opacity={opacity} attribution='Atlas of Living Australia' zIndex={15} />}
                    <FeatureGroup>
                        <EditControl
                            position='topleft'
                            draw={{
                                rectangle: {
                                    showArea: false, // workaround for js error when dragging
                                    shapeOptions: { color: '#bada55' }
                                },
                                circle: {
                                    shapeOptions: {
                                        color: '#bada55'
                                    }
                                },
                                polygon: {
                                    allowIntersection: false, // Restricts shapes to simple polygons
                                    drawError: {
                                        color: '#e1e100', // Color the shape will turn when intersects
                                        message: '<strong>' + intl.formatMessage({ id: 'advancedsearch.js.map.error1' }) + '</strong> ' + intl.formatMessage({ id: 'advancedsearch.js.map.error2' }) // Message that will show when intersects
                                    },
                                    shapeOptions: {
                                        color: '#bada55'
                                    }
                                },
                                polyline: false,
                                marker: false,
                                circlemarker: false
                            }}
                            onCreated={onCreated}
                            onDrawStart={() => { isDrawingRef.current = true; }}
                            onDrawStop={() => { isDrawingRef.current = false; }}
                        />
                    </FeatureGroup>
                </MapContainer>
            </div>
        </>
    );
}

export default MapView;
