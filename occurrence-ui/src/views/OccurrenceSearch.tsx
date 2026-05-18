/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Breadcrumb, FontAwesomeIconLite, useHashState } from '@ala/common-ui';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import L, {LatLng, LeafletMouseEvent} from "leaflet";
import {useEffect, useState, useRef, useCallback} from "react";
import {Tab, Tabs} from "react-bootstrap";
import {Menu, MenuItem, Typeahead} from "react-bootstrap-typeahead";
import '../css/search.css';
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {EditControl} from "react-leaflet-draw";
import {useNavigate} from "react-router-dom";
import ReactLeafletGoogleLayer from 'react-leaflet-google-layer';

import {FeatureGroup, LayersControl, MapContainer, TileLayer} from "react-leaflet";
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

    // Per-facet cache: undefined = not yet fetched, null = loading, Fq[] = loaded
    const [advancedOptions, setAdvancedOptions] = useState<Record<string, {name: string; fq: string}[] | null | undefined>>({});

    const fetchFacet = useCallback((facet: string) => {
        setAdvancedOptions(prev => {
            if (prev[facet] !== undefined) return prev; // already loading or loaded
            return { ...prev, [facet]: null }; // mark as loading
        });
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=*:*&pageSize=0&facets=${facet}&flimit=-1`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                const facetResult = data?.facetResults?.find((fr: any) => fr.fieldName === facet);
                const values = facetResult
                    ? facetResult.fieldResult.map((fr: any) => ({ name: fr.label, fq: fr.fq }))
                    : [];
                setAdvancedOptions(prev => ({ ...prev, [facet]: values }));
            });
    }, []);

    // simple search
    const [simpleTaxa, setSimpleTaxa] = useState('');
    const [taxaOptions, setTaxaOptions] = useState<any[]>([]);

    // advanced search
    const [advancedText, setAdvancedText] = useState('');
    const [advancedTaxa1, setAdvancedTaxa1] = useState('');
    const [advancedTaxa2, setAdvancedTaxa2] = useState('');
    const [advancedTaxa3, setAdvancedTaxa3] = useState('');
    const [advancedTaxa4, setAdvancedTaxa4] = useState('');
    const [advancedRawTaxon, setAdvancedRawTaxon] = useState('');
    const [advancedSpeciesGroup, setAdvancedSpeciesGroup] = useState('');
    const [advancedInstitution, setAdvancedInstitution] = useState('');
    const [advancedCountry, setAdvancedCountry] = useState('');
    const [advancedState, setAdvancedState] = useState('');
    const [advancedIbra, setAdvancedIbra] = useState('');
    const [advancedImcra, setAdvancedImcra] = useState('');
    const [advancedLga, setAdvancedLga] = useState('');
    const [advancedTypeStatus, setAdvancedTypeStatus] = useState('');
    const [advancedBasisOfRecord, setAdvancedBasisOfRecord] = useState('');
    const [advancedDataResource, setAdvancedDataResource] = useState<any[]>([]);
    const [advancedCollector, setAdvancedCollector] = useState('');
    const [advancedCatalogue, setAdvancedCatalogue] = useState('');
    const [advancedRecord, setAdvancedRecord] = useState('');
    const [advancedBeginDate, setAdvancedBeginDate] = useState('');
    const [advancedEndDate, setAdvancedEndDate] = useState('');

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

    const navigate = useNavigate();
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const searchAbort = useRef<AbortController | null>(null);
    const intl: IntlShape = useIntl();

    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
        ]);
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

    function advancedSearch() {
        // AND the individual fqs
        let fqParts: string[] = [];
        if (advancedText) fqParts.push(`text:${advancedText}`);

        // remove double quotes from taxa fields and OR them together
        let taxaParts = [];
        if (advancedTaxa1) taxaParts.push(`taxa:"${advancedTaxa1.replace(/"/g, '\\"')}"`);
        if (advancedTaxa2) taxaParts.push(`taxa:${advancedTaxa2.replace(/"/g, '\\"')}"`);
        if (advancedTaxa3) taxaParts.push(`taxa:${advancedTaxa3.replace(/"/g, '\\"')}"`);
        if (advancedTaxa4) taxaParts.push(`taxa:${advancedTaxa4.replace(/"/g, '\\"')}"`);
        if (taxaParts.length > 0) {
            fqParts.push(`(${taxaParts.join(' OR ')})`);
        }

        if (advancedRawTaxon) fqParts.push(`raw_scientificName:${advancedRawTaxon}`);
        if (advancedSpeciesGroup) fqParts.push(advancedSpeciesGroup);
        if (advancedInstitution) fqParts.push(advancedInstitution);
        if (advancedCountry) fqParts.push(advancedCountry);
        if (advancedState) fqParts.push(advancedState);
        if (advancedIbra) fqParts.push(advancedIbra);
        if (advancedImcra) fqParts.push(advancedImcra);
        if (advancedLga) fqParts.push(advancedLga);
        if (advancedTypeStatus) fqParts.push(advancedTypeStatus);
        if (advancedBasisOfRecord) fqParts.push(advancedBasisOfRecord);
        if (advancedDataResource.length > 0) {
            fqParts.push(advancedDataResource[0].fq);
        }
        if (advancedCollector) fqParts.push(`collector_text:(${advancedCollector})`);
        if (advancedCatalogue) fqParts.push(`catalogNumber:(${advancedCatalogue})`);
        if (advancedRecord) fqParts.push(`recordNumber:(${advancedRecord})`);
        if (advancedBeginDate || advancedEndDate) {
            let begin = advancedBeginDate ? advancedBeginDate + 'T00:00:00Z' : '*';
            let end = advancedEndDate ? advancedEndDate + 'T23:59:59Z' : '*';
            fqParts.push(`eventDate:[${begin} TO ${end}]`);
        }
        const fq = fqParts.map(part => `fq=${encodeURIComponent(part)}`).join('&');
        navigate(`/occurrences/search?${fq}`);

    }

    function advancedClear() {
        setAdvancedText('');
        setAdvancedTaxa1('');
        setAdvancedTaxa2('');
        setAdvancedTaxa3('');
        setAdvancedTaxa4('');
        setAdvancedRawTaxon('');
        setAdvancedSpeciesGroup('');
        setAdvancedInstitution('');
        setAdvancedCountry('');
        setAdvancedState('');
        setAdvancedIbra('');
        setAdvancedImcra('');
        setAdvancedLga('');
        setAdvancedTypeStatus('');
        setAdvancedBasisOfRecord('');
        setAdvancedDataResource([]);
        setAdvancedCollector('');
        setAdvancedCatalogue('');
        setAdvancedRecord('');
        setAdvancedBeginDate('');
        setAdvancedEndDate('');
    }

    function addWktToMap() {
        if (!spatialWkt || !mapRef.current) return;

        // Simple WKT POLYGON parser (assumes valid input)
        const match = spatialWkt.match(/POLYGON\s*\(\(\s*([^)]+)\s*\)\)/i);
        if (!match) {
            return; // TODO: indicate invalid WKT
        }
        const coords: [number, number][] = match[1].split(',').map(pair => {
            const [lng, lat] = pair.trim().split(/\s+/).map(Number);
            return [lat, lng];
        });

        const polygon = L.polygon(coords, { color: '#bada55' }).addTo(mapRef.current);

        polygon.on('click', (event: L.LeafletMouseEvent) => {
            onFeatureClick(polygon, event);
        });
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
        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/qid?q=${encodeURIComponent(query)}`, {
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
            return `wkt=POLYGON((${coords.join(", ")}))`;
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
        const resp1 = await fetch(`https://biocache-ws.ala.org.au/ws/occurrences/search?${terms}&facet=false&pageSize=0`);
        const data1 = await resp1.json();
        const occurrenceCount = data1.totalRecords;
        div.querySelector('#occurrenceCount' + uniqueId)!.textContent = occurrenceCount.toString();

        const resp2 = await fetch(`https://biocache-ws.ala.org.au/ws/occurrences/facets?${terms}&facets=scientificName`);
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

            fetch(`${import.meta.env.VITE_NAMEMATCHING_URL}/api/autocomplete?q=${encodeURIComponent(query)}`, {
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
                        <div className="container-fluid">
                            <div className="mb-3 row mt-2">
                                <h4><FormattedMessage id="advancedsearch.title01" defaultMessage="Find records that have"/></h4>
                                <div className="mb-3 row align-items-center text-end align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="text">
                                        <FormattedMessage id="advancedsearch.table01col01.title" defaultMessage="ALL of these words (full text)"/>
                                    </label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" className="dataset form-control" value={advancedText}
                                               onChange={e => setAdvancedText(e.target.value)}/>
                                    </div>
                                </div>

                                <h4><FormattedMessage id="advancedsearch.title02" defaultMessage="Find records for ANY of the following taxa (matched/processed taxon concepts)"/></h4>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="taxa_1"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_1" className="name_autocomplete form-control" value={advancedTaxa1}
                                               onChange={e => setAdvancedTaxa1(e.target.value)}/>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="taxa_2"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_2" className="name_autocomplete form-control"
                                               value={advancedTaxa2}
                                               onChange={e => setAdvancedTaxa2(e.target.value)}/>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end" id="taxon_row_3">
                                    <label className="col-md-2 control-label" htmlFor="taxa_3"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_3" className="name_autocomplete form-control"
                                               value={advancedTaxa3}
                                               onChange={e => setAdvancedTaxa3(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end" id="taxon_row_4">
                                    <label className="col-md-2 control-label" htmlFor="taxa_4"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_4" className="name_autocomplete form-control"
                                               value={advancedTaxa4}
                                               onChange={e => setAdvancedTaxa4(e.target.value)}/>
                                    </div>
                                </div>

                                <h4 className="margin-bottom-half-1"><FormattedMessage id="advancedsearch.allfields.title" defaultMessage="Find records that specify the following fields"/></h4>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="raw_taxon_name"><FormattedMessage id="advancedsearch.table03col01.title" defaultMessage="Raw Scientific Name"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="raw_taxon_name" className="dataset form-control" value={advancedRawTaxon}
                                               onChange={e => setAdvancedRawTaxon(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="species_group"><FormattedMessage id="advancedsearch.table04col01.title" defaultMessage="Species Group"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="species_group"
                                                value={advancedSpeciesGroup}
                                                onFocus={() => fetchFacet('speciesGroup')}
                                                onChange={e => setAdvancedSpeciesGroup(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table04col01.option.label" defaultMessage="-- select a species group --"/></option>
                                            {advancedOptions?.speciesGroup === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                                            {advancedOptions?.speciesGroup && advancedOptions.speciesGroup.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="institution_collection">
                                        <FormattedMessage id="advancedsearch.table05col01.title" defaultMessage="Institution or Collection"/>
                                    </label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="institution_collection"
                                                value={advancedInstitution}
                                                onFocus={() => { fetchFacet('institutionUid'); fetchFacet('collectionUid'); }}
                                                onChange={e => setAdvancedInstitution(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table05col01.option01.label" defaultMessage="-- select an institution or collection --"/></option>
                                            {advancedOptions?.institutionUid === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                                            {advancedOptions?.institutionUid && advancedOptions.institutionUid.map((institution: any, idx: number) =>
                                                <optgroup key={idx} label={institution.name}>
                                                    <option value={institution.fq}><FormattedMessage id="advancedsearch.table05col01.option02.label" defaultMessage="All records from"/> {institution.name}</option>
                                                    {advancedOptions?.collectionUid && advancedOptions?.collectionUid.filter(c => c.name.startsWith(institution.name)).map((collection: any, idx: number) =>
                                                        <option key={idx} value={collection.fq}>{collection.name.substring(institution.name.length) ||
                                                            (" " + intl.formatMessage({id:"advancedsearch.table05col01.option03.label", defaultMessage:"Collection"}))}</option>
                                                    )}
                                                </optgroup>
                                            )}

                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="country"><FormattedMessage id="advancedsearch.table06col01.title" defaultMessage="Country"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="country" value={advancedCountry}
                                                onFocus={() => fetchFacet('country')}
                                                onChange={e => setAdvancedCountry(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table06col01.option.label" defaultMessage="-- select a country --"/></option>
                                            {advancedOptions?.country === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.country && advancedOptions.country.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="state"><FormattedMessage id="advancedsearch.table06col02.title" defaultMessage="State/Territory"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="state"
                                                value={advancedState}
                                                onFocus={() => fetchFacet('state')}
                                                onChange={e => setAdvancedState(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table06col02.option.label" defaultMessage="-- select a state/territory --"/></option>
                                            {advancedOptions?.state === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.state && advancedOptions.state.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="ibra"><abbr
                                        title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr> <FormattedMessage id="advancedsearch.table06col03.title" defaultMessage="region"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="ibra" value={advancedIbra}
                                                onFocus={() => fetchFacet('cl1048')}
                                                onChange={e => setAdvancedIbra(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table06col03.option.label" defaultMessage="-- select an IBRA region --"/></option>
                                            {advancedOptions?.cl1048 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.cl1048 && advancedOptions.cl1048.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="imcra"><abbr
                                        title="Integrated Marine and Coastal Regionalisation of Australia">IMCRA</abbr> <FormattedMessage id="advancedsearch.table06col04.title" defaultMessage="region"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="imcra" value={advancedImcra}
                                                onFocus={() => fetchFacet('cl21')}
                                                onChange={e => setAdvancedImcra(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table06col04.option.label" defaultMessage="-- select an IMCRA region --"/></option>
                                            {advancedOptions?.cl21 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.cl21 && advancedOptions.cl21.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="lga"><FormattedMessage id="advancedsearch.table06col05.title" defaultMessage="Local Govt. Area"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="lga" value={advancedLga}
                                                onFocus={() => fetchFacet('cl959')}
                                                onChange={e => setAdvancedLga(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table06col05.option.label" defaultMessage="-- select local government area--"/></option>
                                            {advancedOptions?.cl959 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.cl959 && advancedOptions.cl959.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="type_status"><FormattedMessage id="advancedsearch.table07col01.title" defaultMessage="Type Status"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="type_status"
                                                value={advancedTypeStatus}
                                                onFocus={() => fetchFacet('typeStatus')}
                                                onChange={e => setAdvancedTypeStatus(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table07col01.option.label" defaultMessage="-- select a type status --"/></option>
                                            {advancedOptions?.typeStatus === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.typeStatus && advancedOptions.typeStatus.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="basis_of_record"><FormattedMessage id="advancedsearch.table08col01.title" defaultMessage="Basis of record"/></label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="basis_of_record" value={advancedBasisOfRecord}
                                                onFocus={() => fetchFacet('basisOfRecord')}
                                                onChange={e => setAdvancedBasisOfRecord(e.target.value)}>
                                            <option value=""><FormattedMessage id="advancedsearch.table08col01.option.label" defaultMessage="-- select a basis of record --"/></option>
                                            {advancedOptions?.basisOfRecord === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}

                                            {advancedOptions?.basisOfRecord && advancedOptions.basisOfRecord.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="collector_text"><FormattedMessage id="advancedsearch.collector_text.title" defaultMessage="Collector"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="collector_text" className="dataset form-control"
                                               value={advancedCollector}
                                               onChange={e => setAdvancedCollector(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="control-label col-md-2"><FormattedMessage id="advancedsearch.dataset.col.label" defaultMessage="dataset name"/></label>
                                    <div className="col-md-6 ms-2">
                                        <Typeahead
                                            id="dataResource-autocomplete"
                                            labelKey="name"
                                            options={advancedOptions?.dataResourceUid ?? []}
                                            isLoading={advancedOptions?.dataResourceUid === null}
                                            selected={advancedDataResource}
                                            onFocus={() => fetchFacet('dataResourceUid')}
                                            onChange={(selected) => {
                                                setAdvancedDataResource(selected)
                                            }}
                                            renderMenu={(results, menuProps) => (
                                                <Menu {...menuProps}>
                                                    {results.map((result, index) => (
                                                        <MenuItem
                                                            key={index}
                                                            option={result}
                                                            position={index}
                                                            // Override href with the current route so clicking on an item does not change the route and the page does not scroll.
                                                            href={"javascript:"}>
                                                            {typeof result === 'string' ? result : result.name}
                                                        </MenuItem>
                                                    ))}
                                                </Menu>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="catalogue_number"><FormattedMessage id="advancedsearch.table09col01.title" defaultMessage="Catalogue Number"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="catalogue_number" className="form-control" value={advancedCatalogue}
                                               onChange={e => setAdvancedCatalogue(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="record_number"><FormattedMessage id="advancedsearch.table09col02.title" defaultMessage="Record Number"/></label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="record_number" className="form-control" value={advancedRecord}
                                               onChange={e => setAdvancedRecord(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="startDate"><FormattedMessage id="advancedsearch.table10col01.title" defaultMessage="Begin Date"/></label>
                                    <div className="col-md-2 ms-2">
                                        <input type="date" id="startDate" className="form-control" value={advancedBeginDate}
                                               onChange={e => setAdvancedBeginDate(e.target.value)}/>
                                    </div>
                                    <div className="col-md-6 text-start">
                                        <span className="small ms-2"><FormattedMessage id="advancedsearch.table10col01.des" defaultMessage="(YYYY-MM-DD) leave blank for earliest record date"/></span>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="endDate"><FormattedMessage id="advancedsearch.table10col02.title" defaultMessage="End Date"/></label>
                                    <div className="col-md-2 ms-2">
                                        <input type="date" id="endDate" className="occurrence_date form-control"
                                               value={advancedEndDate}
                                               onChange={e => setAdvancedEndDate(e.target.value)}/>
                                    </div>
                                    <div className="col-md-6 text-start">
                                        <span className="small ms-2"><FormattedMessage id="advancedsearch.table10col02.des" defaultMessage="(YYYY-MM-DD) leave blank for most recent record date"/></span>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center">
                                    <div className="col-md-2 ms-3">
                                        <button className="btn btn-primary" onClick={() => advancedSearch()}>
                                            <FormattedMessage id="advancedsearch.button.submit" defaultMessage="Search"/>
                                        </button>
                                        <button id="clearAll" className="btn btn-outline-dark ms-2" onClick={() => advancedClear()}>
                                            <FormattedMessage id="advancedsearch.button.clear.all" defaultMessage="Clear all"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                                              value={spatialWkt} onChange={e => setSpatialWkt(e.target.value)}></textarea>
                                                    <br/>
                                                    <button className="btn btn-primary btn-sm" id="addWkt" onClick={() => addWktToMap()}>
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
