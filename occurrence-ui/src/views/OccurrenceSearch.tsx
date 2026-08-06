/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Breadcrumb, FontAwesomeIconLite, useHashState } from '@ala/common-ui';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import L, {LatLng, LeafletMouseEvent} from "leaflet";
import {useEffect, useState, useRef} from "react";
import {Tab, Tabs} from "react-bootstrap";
import {Typeahead} from "react-bootstrap-typeahead";
import { FormattedMessage, IntlShape } from 'react-intl';
import { useIntl } from '../util/useIntl';
import {EditControl} from "react-leaflet-draw";
import 'leaflet-draw'; // side-effect: mutates global L with Draw tools
import {useNavigate} from "react-router-dom";
import ReactLeafletGoogleLayerBase from 'react-leaflet-google-layer'
const ReactLeafletGoogleLayer = ((ReactLeafletGoogleLayerBase as any)?.default ?? ReactLeafletGoogleLayerBase) as any;
import LazyLoad from "../components/lazyLoad.tsx";
import AdvancedSearchAvh from "../components/search/advancedSearchAvh.tsx";
import {getQc} from "../util/util.tsx";
import { polygonLayerToWkt } from '../util/worldWrapFix';
import AdvancedSearch from '../components/search/AdvancedSearch';

import { FeatureGroup, LayersControl, MapContainer, ScaleControl, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'

// defaults
const center = new LatLng(
    Number(import.meta.env.VITE_MAP_CENTRE_LAT),
    Number(import.meta.env.VITE_MAP_CENTRE_LNG)
);
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);

const hubDisplayName = import.meta.env.VITE_HUB_NAME;

function OccurrenceSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [tab, setTab] = useHashState('tab', 'simple');

    // simple search
    const [simpleTaxa, setSimpleTaxa] = useState('');
    const [taxaOptions, setTaxaOptions] = useState<any[]>([]);

    // batch taxon search
    const [taxonText, setTaxonText] = useState('');
    const [taxonMode, setTaxonMode] = useState('taxa');

    // catalogue search
    const [catalogueText, setCatalogueText] = useState('');

    // event search
    const [eventTerms, setEventTerms] = useState('');
    const [eventIds, setEventIds] = useState('');
    const [eventParentIds, setEventParentIds] = useState('');
    const [eventFieldNumbers, setEventFieldNumbers] = useState('');
    const [eventNames, setEventNames] = useState('');

    // spatial search
    const [spatialWkt, setSpatialWkt] = useState('');
    const [wktError, setWktError] = useState('');

    const navigate = useNavigate();
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchAbort = useRef<AbortController | null>(null);
    const intl: IntlShape = useIntl();

    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
        ]);

        document.title = `Search for records | ${hubDisplayName}`;
    }, []);

    useEffect(() => {
        if (tab === 'spatial') {
            setTimeout(() => {
                mapRef.current?.invalidateSize(false);
            }, 300); // Adjust timeout to tab transition
        }
    }, [tab]);

    function simpleSearch() {
        let simpleTaxaEscaped = simpleTaxa.replace(/"/g, '\\"').trim();
        if (!simpleTaxaEscaped) {
            navigate(`/occurrences/search?q=*:*`);
        } else {
            navigate(`/occurrences/search?q=${encodeURIComponent('taxa:"' + simpleTaxaEscaped + '"')}`);
        }
    }

    function addWktToMap() {
        setWktError('');


        if (!mapRef.current) return;

        try {
            // Simple WKT POLYGON parser — supports POLYGON and MULTIPOLYGON
            const match = spatialWkt.match(/POLYGON\s*\(\(\s*([^)]+)\s*\)\)/i);
            if (!match) {
                throw new Error('Not a valid POLYGON WKT');
            }

            const coords: [number, number][] = match[1].split(',').map(pair => {
                const parts = pair.trim().split(/\s+/);
                const lng = Number(parts[0]);
                const lat = Number(parts[1]);
                if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid coordinate pair');
                return [lat, lng];
            });

            if (coords.length < 3) {
                throw new Error('Polygon must have at least 3 coordinate pairs');
            }

            const polygon = L.polygon(coords, { color: '#bada55' }).addTo(mapRef.current);
            mapRef.current.fitBounds(polygon.getBounds());

            polygon.on('click', (event: L.LeafletMouseEvent) => {
                onFeatureClick(polygon, event);
            });
        } catch (e) {
            console.error(e);
            setWktError(intl.formatMessage({ id: 'search.map.wkt.error.invalid', defaultMessage: 'Please paste a valid WKT string' }));
        }
    }

    function batchSearch(searchText: string, fields: string[]) {
        // Do not escape quotes, it does not work in the existing biocache-hub so no need to address it
        // remove double quotes
        const cleanedText = searchText.replace(/"/g, '');

        // split by new line and trim
        const values = cleanedText.trim().split('\n').map(num => num.trim()).filter(num => num);

        // build query string (field1:"value1" OR field2:"value1" OR ...) for all values
        let query = '';
        fields.forEach(field => {
            if (query) query += ' OR ';
            query += values.map(value => `${field}:"${value}"`).join(' OR ');
        })

        // get qid with POST to https://biocache.ala.org.au/ws/qid?q=query (returns plain text qid)
        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/qid?q=${encodeURIComponent(query)}${getQc()}`, {
            method: 'POST'
        }).then(response => response.text()).then(data => {
            const qid = data.trim();
            navigate(`/occurrences/search?q=qid:${qid}`);
        });
    }

    function onCreated(e: any) {
        const layer = e.layer;

        // add onclick to e.layer itself
        layer.on('click', (event: LeafletMouseEvent) => {
            onFeatureClick(layer, event);
        });
        // setFeatures(prev => [...prev, layer]);
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

    async function onFeatureClick(layer: any, e: LeafletMouseEvent) {
        // 1. Get WKT from the layer (implement getWktFromLayer as needed)
        const terms = getTermsFromLayer(layer);
        const uniqueId = Date.now(); // Simple unique ID for this popup instance

        // 2. Set popup content
        const div = document.createElement('div');
        div.innerHTML = `
            <div>${intl.formatMessage({id:'advancedsearch.js.map.common.speciescount'})}: <span id="taxonCount${uniqueId}" class="fw-bold">calculating...</div>
            <div>${intl.formatMessage({id:'advancedsearch.js.map.common.occurrencecount'})}: <span id="occurrenceCount${uniqueId}" class="fw-bold">calculating...</span></div>
            <a href="/occurrences/search?${terms}" style="color: #C44D34 !important;">${intl.formatMessage({id:'search.map.popup.linkText'})}</a><br/>
            <a href="#" id="remove-area-btn" style="color: #C44D34 !important;">${intl.formatMessage({id:'search.map.popup.removeText'})}</a>
        `;

        // Attach event handler
        div.querySelector('#remove-area-btn')?.addEventListener('click', () => {
            mapRef.current?.removeLayer(layer);
            mapRef.current?.closePopup();
        });

        L.popup()
            .setLatLng(e.latlng)
            .setContent(div)
            .openOn(mapRef.current!);

        // 3. Fetch counts
        const resp1 = await fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?${terms}&facet=false&pageSize=0${getQc()}`);
        const data1 = await resp1.json();
        const occurrenceCount = data1.totalRecords;
        div.querySelector('#occurrenceCount' + uniqueId)!.textContent = occurrenceCount.toString();

        const resp2 = await fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/facets?${terms}&facets=scientificName${getQc()}`);
        const data2 = await resp2.json();
        const taxonCount = data2[0].count;
        div.querySelector('#taxonCount' + uniqueId)!.textContent = taxonCount.toString();
    }

    function handleSearch(query: string) {
        if (!query) return;

        // Cancel previous debounce
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        // Abort previous fetch
        if (searchAbort.current) searchAbort.current.abort();

        searchTimeout.current = setTimeout(() => {
            const controller = new AbortController();
            searchAbort.current = controller;

            fetch(`${import.meta.env.VITE_NAMEMATCHING_URL}/api/autocomplete?q=${encodeURIComponent(query)}${getQc()}`, {
                signal: controller.signal
            })
                .then(res => res.json())
                .then(data => setTaxaOptions(data || []));
        }, 300); // 300ms debounce
    }

    return <>
        <div id="main" className="container-fluid">
            <div className="container-fluid">
                <div id="headingBar" className="">
                    <h1 className="w-100" id="searchHeader">
                        <FormattedMessage id="home.index.body.title" defaultMessage="Search for records in"/> {hubDisplayName}</h1>
                </div>

                <Tabs id="occurrence-tabs" activeKey={tab} onSelect={(k) => setTab("" + k)}>
                    <Tab eventKey="simple" title={intl.formatMessage({id:'home.index.navigator01', defaultMessage: 'Simple search'})}>
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-9 col-md-9">
                                    <div className="input-group mt-2">
                                        <Typeahead
                                            id="simple-taxa-autocomplete"
                                            labelKey="name"
                                            minLength={3}
                                            onInputChange={query => {
                                                setSimpleTaxa(query);
                                                handleSearch(query);
                                            }}
                                            options={taxaOptions}
                                            // placeholder="Type a species/taxon name..."
                                            onChange={selected => {
                                                const value = typeof selected[0] === "string"
                                                    ? selected[0]
                                                    : selected[0]?.name || "";
                                                setSimpleTaxa(value);
                                            }}
                                            selected={simpleTaxa ? taxaOptions.filter(opt => opt.name === simpleTaxa) : []}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    simpleSearch();
                                                }
                                            }}
                                        />
                                        <button className="btn btn-primary" onClick={() => simpleSearch()}>
                                            <FormattedMessage id='home.index.simsplesearch.button' defaultMessage='Search' />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                                <span className="simpleSearchNote" dangerouslySetInnerHTML={{ __html: intl.formatMessage({id: 'home.index.simsplesearch.span', defaultMessage: 'Note: the simple search attempts to match a known species/taxon - by its scientific name or common name. If there are no name matches, a full text search will be performed on your query'})}} />
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="advanced" title={intl.formatMessage({id:'home.index.navigator02', defaultMessage: 'Advanced search'})}>
                        <LazyLoad active={tab === 'advanced'}>
                            { import.meta.env.VITE_SKIN === 'AVH' ? <AdvancedSearchAvh /> : <AdvancedSearch />}
                        </LazyLoad>
                    </Tab>
                    <Tab eventKey="taxon" title={intl.formatMessage({id:'home.index.navigator03', defaultMessage: 'Batch taxon search'})}>
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="raw_names" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.taxaupload.des01"
                                                   defaultMessage="Enter a list of taxon names/scientific names, one name per line (common names not currently supported)."/>
                                    </label>
                                    <textarea id="raw_names" className="form-control" rows={15} cols={60}
                                              value={taxonText}
                                              onChange={e => setTaxonText(e.target.value)}>
                                </textarea>
                                </div>
                            </div>

                            <div className="mb-3 row">
                                <div className="col-sm-1">
                                    <FormattedMessage id="home.index.taxaupload.batchRadioPrefix" defaultMessage="Search on:"/>
                                </div>

                                <div className="col-sm-6">
                                    <div className="form-check">
                                        <input type="radio" name="field" id="batchModeMatched" value="taxa"
                                               checked={taxonMode === "taxa"} className="form-check-input"
                                               onChange={(e) => setTaxonMode(e.target.value)}/>
                                        <label className="form-check-label" htmlFor="batchModeMatched">
                                            <FormattedMessage id="home.index.taxaupload.batchMode.matched.param" defaultMessage="Matched name"/>&nbsp;
                                            <abbr title={intl.formatMessage({id:'advanced.taxon.tooltip.matched.param', defaultMessage: 'N/A'})}>
                                                <FontAwesomeIconLite icon={faQuestionCircle}/>
                                            </abbr>
                                        </label>
                                    </div>
                                    <div className="form-check">
                                        <input type="radio" name="field" id="batchModeRaw"
                                               value="raw_scientificName" className="form-check-input"
                                               checked={taxonMode === "raw_scientificName"}
                                               onChange={(e) => setTaxonMode(e.target.value)}/>
                                        <label className="form-check-label" htmlFor="batchModeRaw">
                                            <FormattedMessage id="home.index.taxaupload.batchMode.provided" defaultMessage="Supplied name"/>&nbsp;
                                            <abbr title={intl.formatMessage({id:'advanced.taxon.tooltip.supplied', defaultMessage: 'N/A'})}>
                                                <FontAwesomeIconLite icon={faQuestionCircle}/></abbr>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(taxonText, [taxonMode])}>
                                        <FormattedMessage id="home.index.catalogupload.button01" defaultMessage="Search" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="catalogue" title={intl.formatMessage({id:'home.index.navigator04', defaultMessage: 'Catalogue number search'})}>
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="catalogue_numbers" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.catalogupload.des01" defaultMessage="Enter a list of catalogue numbers (one number per line)."/>
                                    </label>

                                    <textarea id="catalogue_numbers" className="form-control" rows={15} cols={60} value={catalogueText}
                                              onChange={e => setCatalogueText(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(catalogueText, ["catalogNumber"])}>
                                        <FormattedMessage id="home.index.catalogupload.button01" defaultMessage="Search"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="event" title={intl.formatMessage({id:'home.index.navigator06', defaultMessage: 'Event search'})}>
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.eventsearch.general.des" defaultMessage="Search across event ID, parent event ID, field number and dataset / survey name."/>
                                    </label>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-8">
                                    <label className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.eventsearch.general.des01" defaultMessage="Enter a list of terms (one per line)."/>
                                    </label>

                                    <textarea id="event_keywords" className="form-control" rows={5} cols={60} value={eventTerms}
                                              onChange={e => setEventTerms(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(eventTerms, ["text_eventID", "text_parentEventID", "text_fieldNumber", "text_datasetName"])}>
                                        <FormattedMessage id='button.search' defaultMessage='Search' />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.eventsearch.des01" defaultMessage="Enter a list of parent event IDs (one per line)."/>
                                    </label>
                                    <textarea id="event_ids" className="form-control" rows={5} cols={60} value={eventIds}
                                              onChange={e => setEventIds(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(eventIds, ["text_eventID"])}>
                                        <FormattedMessage id='button.search' defaultMessage='Search' />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.parenteventsearch.des01" defaultMessage="Enter a list of parent event IDs (one per line)."/>
                                    </label>
                                    <textarea id="parent_event_ids" className="form-control" rows={5} cols={60} value={eventParentIds}
                                              onChange={e => setEventParentIds(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(eventParentIds, ["text_parentEventID"])}>
                                        <FormattedMessage id='button.search' defaultMessage='Search' />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.fieldnumbersearch.des01" defaultMessage="Enter a list of field numbers (one per line)."/>
                                    </label>
                                    <textarea name="queries" id="field_numbers" className="form-control" rows={5} cols={60} value={eventFieldNumbers}
                                              onChange={e => setEventFieldNumbers(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(eventFieldNumbers, ["text_fieldNumber"])}>
                                        <FormattedMessage id='button.search' defaultMessage='Search' />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">
                                        <FormattedMessage id="home.index.datasetnamesearch.des01" defaultMessage="Enter a list of dataset / survey names (one per line)."/>
                                    </label>
                                    <textarea name="queries" id="dataset_name" className="form-control" rows={5} cols={60} value={eventNames}
                                              onChange={e => setEventNames(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary" onClick={() => batchSearch(eventNames, ["text_datasetName"])}>
                                        <FormattedMessage id='button.search' defaultMessage='Search' />
                                    </button>
                                </div>
                            </div>
                        </div>

                    </Tab>
                    <Tab eventKey="spatial" title={intl.formatMessage({id:'home.index.navigator05', defaultMessage: 'Spatial search'})}>
                        <div className="container-fluid">
                            <div className="mb-3 row">
                                <div className="col-sm-3 col-md-3 pe-3">
                                    <div>
                                        <FormattedMessage id="search.map.helpText" defaultMessage="Select one of the draw tools (polygon, rectangle, circle), draw a shape and click the search link that pops up."/>
                                    </div>
                                    <br/>

                                    <div className="accordion" id="importAreaAccordion">
                                        <div className="accordion-item">
                                            <h2 className="accordion-header" id="importAreaHeading">
                                                <button className="accordion-button collapsed" type="button" onClick={() => {
                                                    // toggle id=importAreaContent item collapse
                                                    const content = document.getElementById("importAreaContent");
                                                    if (content) {
                                                        if (content.classList.contains("show")) {
                                                            content.classList.remove("show");
                                                        } else {
                                                            content.classList.add("show");
                                                        }
                                                    }
                                                }}>
                                                    <FormattedMessage id="search.map.importToggle" defaultMessage="Import WKT"/>
                                                </button>
                                            </h2>

                                            <div id="importAreaContent" className="accordion-collapse collapse">
                                                <div className="accordion-body">
                                                    <p><span dangerouslySetInnerHTML={{ __html: intl.formatMessage({ id: 'search.map.importText'})}}/></p>
                                                    <p><span dangerouslySetInnerHTML={{ __html: intl.formatMessage({ id: "search.map.importText.spatialportal"}) }} /></p>

                                                    <p><FormattedMessage id="search.map.wktHelpText" defaultMessage="Optionally, paste a WKT string: "/></p>
                                                    <textarea id="wktInput" style={{height: "280px", width: "95%"}}
                                                              value={spatialWkt} onChange={e => { setSpatialWkt(e.target.value); setWktError(''); }}></textarea>
                                                    <br/>
                                                    {wktError && <div className="text-danger mt-1 mb-1">{wktError}</div>}
                                                    <button className="btn btn-primary btn-sm" id="addWkt" disabled={!spatialWkt.trim()} onClick={() => addWktToMap()}>
                                                        <FormattedMessage id="search.map.wktButtonText" defaultMessage="Add to map"/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-sm-9 col-md-9">
                                    <div id="leafletMap" style={{height: "655px", position: "relative"}}>
                                        <MapContainer
                                            ref={mapRef}
                                            center={center}
                                            zoom={defaultZoom}
                                            scrollWheelZoom={false}
                                            worldCopyJump={true}
                                            style={{ height: '655px', borderRadius: '10px', }}>
                                            <ScaleControl position='bottomright' imperial={false} />
                                            {!import.meta.env.VITE_GOOGLE_MAP_API_KEY &&
                                                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />
                                            }
                                            {import.meta.env.VITE_GOOGLE_MAP_API_KEY && (
                                                <LayersControl position="topright">
                                                    <LayersControl.BaseLayer checked name="Minimal">
                                                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Road">
                                                        <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'roadmap'} />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Terrain">
                                                        <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'terrain'} />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Satellite">
                                                        <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'satellite'} />
                                                    </LayersControl.BaseLayer>
                                                </LayersControl>
                                            )}
                                            <FeatureGroup>
                                                <EditControl
                                                    position='topleft'
                                                    draw={{
                                                        rectangle: {
                                                            showArea: false, // workaround for js error when dragging
                                                            shapeOptions: {color: '#bada55'}
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
                                                                message: '<strong>' + intl.formatMessage({id: 'advancedsearch.js.map.error1'}) + '</strong> ' + intl.formatMessage({id: 'advancedsearch.js.map.error2'}) // Message that will show when intersect
                                                            },
                                                            shapeOptions: {
                                                                color: '#bada55'
                                                            }
                                                        },
                                                        polyline: false,
                                                        marker: false,
                                                        circlemarker: false,
                                                    }}
                                                    onCreated={onCreated}
                                                />
                                            </FeatureGroup>
                                        </MapContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tab>
                </Tabs>
            </div>
        </div>
    </>
}

export default OccurrenceSearch;
