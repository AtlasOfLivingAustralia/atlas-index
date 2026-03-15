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
import { FeatureGroup, LayersControl, MapContainer, TileLayer, WMSTileLayer, useMapEvents } from 'react-leaflet';
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

// TODO: move to config
const org = 'ALA';
const center = new LatLng(
    Number(import.meta.env.VITE_MAP_CENTRE_LAT),
    Number(import.meta.env.VITE_MAP_CENTRE_LNG)
);
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);
const defaultOpacity = 0.8;
const defaultPointSize = 5;
const defaultColour = 'df4a21';

// Component to handle map click events
function MapClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
    useMapEvents({
        click: (e) => {
            onClick(e);
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
    const intl: IntlShape = useIntl();

    // Render popup content when mapLookupOccurrence changes
    useEffect(() => {
        console.log('mapLookupOccurrence changed', mapLookupOccurrence, mapLookupLatLng, mapRef.current);
        if (!mapLookupOccurrence || !mapRef.current || !mapLookupLatLng) return;
        console.log('rendering popup for occurrence at ', mapLookupLatLng);

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
                // @ts-ignore
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

        // TODO: write it correctly to pass data quality info
        // add data quality filters
        // if (dataQualityInfo) {
        //     dataQualityInfo.disabledQualityFilters.forEach(filter => {
        //         url.searchParams.append("disableQualityFilter", filter);
        //     });
        //     if (dataQualityInfo.disableAllQualityFilters) {
        //         url.searchParams.append("disableAllQualityFilters", "true");
        //     }
        // }
        return url.toString();
    }

    function onCreated(e: any) {
        const layer = e.layer;

        // add onclick to e.layer itself
        layer.on('click', (event: LeafletMouseEvent) => {
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
                console.log('fetched occurrence', data);
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
                {/*TODO: convert to navigate*/}
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
                    <a className='btn btn-sm btn-default'
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
                    <button className='btn btn-sm btn-default ms-auto' style={{ fontSize: '12px', lineHeight: '14px', paddingTop: '2px' }} onClick={mapLookupItemIdx > 0 ? prevOccurrence : undefined} disabled={mapLookupItemIdx === 0 || mapLookupOccurrences.length <= 1}
                            dangerouslySetInnerHTML={{ __html: prev }}>
                    </button>
                    <button
                        className='btn btn-sm btn-default ms-1'
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
        // 1. Get WKT from the layer (implement getWktFromLayer as needed)
        const terms = getTermsFromLayer(layer);
        const uniqueId = Date.now(); // Simple unique ID for this popup instance

        // 2. Set popup content
        const div = document.createElement('div');
        div.innerHTML = `
            <div>${intl.formatMessage({ id: 'advancedsearch.js.map.common.speciescount' })}: <span id="taxonCount${uniqueId}" class="fw-bold">calculating...</div>
            <div>${intl.formatMessage({ id: 'advancedsearch.js.map.common.occurrencecount' })}: <span id="occurrenceCount${uniqueId}" class="fw-bold">calculating...</span></div>
            <a href="/occurrences/search?${terms}" style="color: #C44D34 !important;">${intl.formatMessage({ id: 'search.map.popup.linkText' })}</a><br/>
            <a href="#" id="remove-area-btn" style="color: #C44D34 !important;">${intl.formatMessage({ id: 'search.map.popup.removeText' })}</a>
        `;

        // Attach event handler
        div.querySelector('#remove-area-btn')?.addEventListener('click', () => {
            mapRef.current?.removeLayer(layer);
            mapRef.current?.closePopup();
        });

        L.popup().setLatLng(e.latlng).setContent(div).openOn(mapRef.current!);

        // 3. Fetch counts
        const resp1 = await fetch(`https://biocache-ws.ala.org.au/ws/occurrences/search?${terms}&facet=false&pageSize=0`);
        const data1 = await resp1.json();
        const occurrenceCount = data1.totalRecords;
        div.querySelector('#occurrenceCount' + uniqueId)!.textContent = occurrenceCount.toString();

        const resp2 = await fetch(`https://biocache-ws.ala.org.au/ws/occurrences/facets?${terms}&facets=scientificName`);
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
            const latlngs = layer.getLatLngs()[0]; // Assuming single polygon
            // Ensure latlngs is always an array of L.LatLng
            // const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
            let ring: L.LatLng[] = [];
            if (Array.isArray(latlngs)) {
                if (Array.isArray(latlngs[0])) {
                    ring = latlngs[0] as L.LatLng[];
                } else {
                    ring = latlngs as L.LatLng[];
                }
            } else {
                ring = [latlngs as L.LatLng];
            }
            const coords = ring.map((latlng: L.LatLng) => `${latlng.lng} ${latlng.lat}`);
            // Ensure the polygon is closed
            if (coords[0] !== coords[coords.length - 1]) {
                coords.push(coords[0]);
            }
            // TODO: port the intl date line support from biocache-hubs
            return `wkt=POLYGON((${coords.join(', ')}))`;
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
            console.log('grid size: ' + sz + ' for point size: ' + pointSize);
            extra = '&GRIDDETAIL=' + sz;
        } else {
            style = 'colormode%3A' + colourBy;
        }

        if (hiddenFacets.length > 0) {
            // &HQ=1&HQ=2...
            extra += hiddenFacets.map(facet => `&HQ=${encodeURIComponent(facet)}`).join('');
        }

        // TODO: add dq params
        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect${queryString}&ENV=${style}%3Bname%3Acircle%3Bsize%3A${pointSize}%3Bopacity%3A1&OUTLINE=${outline}${extra}`;
    }

    function getLegendImgUrl() {
        if (colourBy === 'grid') {
            // TODO: add dq params
            return `${import.meta.env.VITE_APP_BIOCACHE_URL}/density/legend${queryString}`;
        }

        return undefined;
    }

    function mapClick(e: LeafletMouseEvent) {
        console.log('map clicked', e.latlng);
        if (!queryString) {
            return;
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
        // TODO: use a better approach
        if (pointSize >= 5 && pointSize < 8) {
            radius *= 2;
        }
        if (pointSize >= 8) {
            radius *= 3;
        }

        // TODO: the new click is ignoring any prior lon/lat/radius params in the query string, fix

        // biocache query for this location
        setMapLookupQueryParams(`&lon=${e.latlng.lng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`);
        setMapLookupLatLng(e.latlng);
        setMapLookupOccurrence(undefined);
        setMapLookupItemIdx(0);
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/info${queryString}&lon=${e.latlng.lng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`;
        fetch(url, {
            method: 'GET'
        }).then(response => response.json()).then((data) => {

            console.log('map lookup data', data);
            //setMapLookupCount(data.count);
            setMapLookupOccurrences(data.occurrences);

            if (!mapRef.current) {
                return;
            }

            if (data.count == 0) {
                return;
            }
            console.log('fetching occurrence  ' + data.count);
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
            // TODO: add dq params
            let url = new URL(import.meta.env.VITE_APP_BIOCACHE_URL + '/mapping/legend' + queryString + "&cm=" + encodeURIComponent(colourBy));
            fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    console.log('data', data);
                    let facets: any[] = [];
                    for (let item of data) {
                        facets.push(item);
                    }
                    setHiddenFacets([]); // TODO: finish this functionality
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

    return (
        <>
            <div>
                <a className='btn btn-default btn-sm tooltips me-1' style={{ textDecoration: 'none' }} href={buildSpatialUrl()} title={intl.formatMessage({ id: 'map.spatialportal.btn.title.param' }, { 0: org })}>
                    <FontAwesomeIconLite icon={faMapMarker} />
                    &nbsp;&nbsp;
                    <FormattedMessage id='map.spatialportal.btn.label' defaultMessage='View in spatial portal' />
                </a>

                <a className='btn btn-default btn-sm tooltips' style={{ textDecoration: 'none' }} onClick={() => alert('TODO: implement map downloads')} title={intl.formatMessage({ id: 'map.downloadmaps.btn.title' })}>
                    <FontAwesomeIconLite icon={faDownload} />
                    &nbsp;&nbsp;
                    <FormattedMessage id='map.downloadmaps.btn.label' defaultMessage='View in spatial portal' />
                </a>

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

                    {/* Handle map click events */}
                    <MapClickHandler onClick={mapClick} />

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
                                        message: '<strong>' + intl.formatMessage({ id: 'advancedsearch.js.map.error1' }) + '</strong> ' + intl.formatMessage({ id: 'advancedsearch.js.map.error2' }) // Message that will show when intersect
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
                        />
                    </FeatureGroup>
                </MapContainer>
            </div>
        </>
    );
}

export default MapView;
