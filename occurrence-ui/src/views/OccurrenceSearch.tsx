import {Breadcrumb, useHashState} from "@ala/common-ui";
import L, {LatLng, LeafletMouseEvent} from "leaflet";
import {useEffect, useState, useRef} from "react";
import {Tab, Tabs} from "react-bootstrap";
import {Menu, MenuItem, Typeahead} from "react-bootstrap-typeahead";
import '../css/search.css';
import {EditControl} from "react-leaflet-draw";
import {useNavigate} from "react-router-dom";
import {AdvancedSearch} from "../api/model.tsx";
import ReactLeafletGoogleLayer from 'react-leaflet-google-layer';

import advancedSearchJson from '../config/advancedSearch.json';
import {FeatureGroup, LayersControl, MapContainer, TileLayer} from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'

// defaults
const center = new LatLng(
    Number(import.meta.env.VITE_MAP_CENTRE_LAT),
    Number(import.meta.env.VITE_MAP_CENTRE_LNG)
);
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);

function OccurrenceSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [tab, setTab] = useHashState('tab', 'simple');
    const [advancedOptions, setAdvancedOptions] = useState<AdvancedSearch>();

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

    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
        ]);

        // TODO: using a compiled src file, but it should be a remote file loaded on demand
        setAdvancedOptions(
            Object.fromEntries(
                Object.entries(advancedSearchJson).map(([key, arr]) => [
                    key, Array.isArray(arr) ? arr.map((item: any) => ({...item, href: item.href ?? ""})) : arr
                ])
            ) as AdvancedSearch
        );
    }, []);

    useEffect(() => {
        if (tab === 'spatial') {
            setTimeout(() => {
                // @ts-ignore
                mapRef.current?.invalidateSize(false);
            }, 300); // Adjust timeout to tab transition
        }
    }, [tab]);

    function simpleSearch() {
        let simpleTaxaEscaped = simpleTaxa.replace(/"/g, '\\"');
        navigate(`/occurrences/search?q=${encodeURIComponent("taxa:\"" + simpleTaxaEscaped + "\"")}`);
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
        console.log('addWktToMap', spatialWkt);
        if (!spatialWkt || !mapRef.current) return;

        // Simple WKT POLYGON parser (assumes valid input)
        const match = spatialWkt.match(/POLYGON\s*\(\(\s*([^)]+)\s*\)\)/i);
        if (!match) {
            alert('Invalid WKT POLYGON');
            return;
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
            <div>Taxon count: <span id="taxonCount${uniqueId}" class="fw-bold">calculating...</div>
            <div>Occurrence count: <span id="occurrenceCount${uniqueId}" class="fw-bold">calculating...</span></div>
            <a href="/occurrences/search?${terms}" style="color: #C44D34 !important;">Search for records in this area</a><br/>
            <a href="#" id="remove-area-btn" style="color: #C44D34 !important;">Remove this area</a>
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

            fetch(`https://namematching-ws.ala.org.au/api/autocomplete?q=${encodeURIComponent(query)}`, {
                signal: controller.signal
            })
                .then(res => res.json())
                .then(data => setTaxaOptions(data || []))
                .catch(e => {
                    if (e.name !== "AbortError") console.error(e);
                });
        }, 300); // 300ms debounce
    }

    return <>
        <div id="main" className="container-fluid">
            <div className="container-fluid">
                <div id="headingBar" className="">
                    <h1 className="w-100" id="searchHeader">Search for records in Atlas of Living Australia</h1>
                </div>

                <Tabs
                    id="occurrence-tabs"
                    activeKey={tab}
                    onSelect={(k) => setTab("" + k)}
                    className=""
                >
                    <Tab eventKey="simple" title="Simple search">
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-9 col-md-9">
                                    <div className="input-group mt-2">
                                        <Typeahead
                                            id="simple-taxa-autocomplete"
                                            labelKey="name"
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
                                        <button className="btn btn-primary" onClick={() => simpleSearch()}>Search
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                            <span className="simpleSearchNote">
                                <b>Note:</b> the simple search attempts to match a known <b>species/taxon</b> - by its scientific name or common name. If there are no name matches, a <b>full text</b> search will be performed on your query
                            </span>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="advanced" title="Advanced search">
                        <div className="container-fluid">
                            <div className="mb-3 row mt-2">
                                <h4>Find records that have</h4>
                                <div className="mb-3 row align-items-center text-end align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="text">ALL of these words (full
                                        text)</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" className="dataset form-control"
                                               value={advancedText}
                                               onChange={e => setAdvancedText(e.target.value)}/>
                                    </div>
                                </div>

                                <h4>Find records for ANY of the following taxa
                                    (matched/processed taxon concepts)</h4>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="taxa_1">Species/Taxon</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_1" className="name_autocomplete form-control"
                                               value={advancedTaxa1}
                                               onChange={e => setAdvancedTaxa1(e.target.value)}/>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="taxa_2">Species/Taxon</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_2" className="name_autocomplete form-control"
                                               value={advancedTaxa2}
                                               onChange={e => setAdvancedTaxa2(e.target.value)}/>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end" id="taxon_row_3">
                                    <label className="col-md-2 control-label" htmlFor="taxa_3">Species/Taxon</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_3" className="name_autocomplete form-control"
                                               value={advancedTaxa3}
                                               onChange={e => setAdvancedTaxa3(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end" id="taxon_row_4">
                                    <label className="col-md-2 control-label" htmlFor="taxa_4">Species/Taxon</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="taxa_4" className="name_autocomplete form-control"
                                               value={advancedTaxa4}
                                               onChange={e => setAdvancedTaxa4(e.target.value)}/>
                                    </div>
                                </div>

                                <h4 className="margin-bottom-half-1">Find records that specify the following fields</h4>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="raw_taxon_name">Provided
                                        scientific
                                        name</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="raw_taxon_name" className="dataset form-control"
                                               value={advancedRawTaxon}
                                               onChange={e => setAdvancedRawTaxon(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="species_group">Species
                                        group</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="species_group"
                                                value={advancedSpeciesGroup}
                                                onChange={e => setAdvancedSpeciesGroup(e.target.value)}>
                                            <option value="">-- select a species group --</option>
                                            {advancedOptions?.speciesGroup && advancedOptions.speciesGroup.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="institution_collection">Institution
                                        or collection</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="institution_collection"
                                                value={advancedInstitution}
                                                onChange={e => setAdvancedInstitution(e.target.value)}>
                                            <option value="">-- select an institution or collection --</option>
                                            {advancedOptions?.institutionUid && advancedOptions.institutionUid.map((institution: any, idx: number) =>
                                                <optgroup key={idx} label={institution.name}>
                                                    <option value={institution.fq}>All records
                                                        from {institution.name}</option>
                                                    {advancedOptions?.collectionUid && advancedOptions?.collectionUid.filter(c => c.name.startsWith(institution.name)).map((collection: any, idx: number) =>
                                                        <option key={idx}
                                                                value={collection.fq}>{collection.name.substring(institution.name.length) || " Collection"}</option>
                                                    )}
                                                </optgroup>
                                            )}

                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="country">Country</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="country"
                                                value={advancedCountry}
                                                onChange={e => setAdvancedCountry(e.target.value)}>
                                            <option value="">-- select a country --</option>

                                            {advancedOptions?.country && advancedOptions.country.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="state">State/Territory</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="state"
                                                value={advancedState}
                                                onChange={e => setAdvancedState(e.target.value)}>
                                            <option value="">-- select a state/territory --</option>

                                            {advancedOptions?.state && advancedOptions.state.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="ibra"><abbr
                                        title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr> region</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="ibra"
                                                value={advancedIbra}
                                                onChange={e => setAdvancedIbra(e.target.value)}>
                                            <option value="">-- select an IBRA region --</option>

                                            {advancedOptions?.cl1048 && advancedOptions.cl1048.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="imcra"><abbr
                                        title="Integrated Marine and Coastal Regionalisation of Australia">IMCRA</abbr> region</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="imcra"
                                                value={advancedImcra}
                                                onChange={e => setAdvancedImcra(e.target.value)}>
                                            <option value="">-- select an IMCRA region --</option>

                                            {advancedOptions?.cl21 && advancedOptions.cl21.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="lga">Local Govt. Area</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="lga"
                                                value={advancedLga}
                                                onChange={e => setAdvancedLga(e.target.value)}>
                                            <option value="">-- select local government area--</option>

                                            {advancedOptions?.cl959 && advancedOptions.cl959.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>
                                    </div>
                                </div>


                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="type_status">Type status</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="type_status"
                                                value={advancedTypeStatus}
                                                onChange={e => setAdvancedTypeStatus(e.target.value)}>
                                            <option value="">-- select a type status --</option>

                                            {advancedOptions?.typeStatus && advancedOptions.typeStatus.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>

                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="basis_of_record">Basis of
                                        record</label>
                                    <div className="col-md-6 ms-2">
                                        <select className="form-select form-control" id="basis_of_record"
                                                value={advancedBasisOfRecord}
                                                onChange={e => setAdvancedBasisOfRecord(e.target.value)}>
                                            <option value="">-- select a basis of record --</option>

                                            {advancedOptions?.basisOfRecord && advancedOptions.basisOfRecord.map((item: any, idx: number) =>
                                                <option key={idx} value={item.fq}>{item.name}</option>
                                            )}

                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="collector_text">Collector
                                        name</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="collector_text" className="dataset form-control"
                                               value={advancedCollector}
                                               onChange={e => setAdvancedCollector(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="control-label col-md-2">Data Resource</label>
                                    <div className="col-md-6 ms-2">
                                        {advancedOptions?.dataResourceUid && <Typeahead
                                            id="dataResource-autocomplete"
                                            labelKey="name"
                                            options={advancedOptions.dataResourceUid}
                                            selected={advancedDataResource}
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
                                                            {/* @ts-ignore */}
                                                            {result.name}
                                                        </MenuItem>
                                                    ))}
                                                </Menu>
                                            )}
                                        />
                                        }
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="catalogue_number">Catalogue
                                        number</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="catalogue_number" className="form-control"
                                               value={advancedCatalogue}
                                               onChange={e => setAdvancedCatalogue(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="record_number">Record
                                        number</label>
                                    <div className="col-md-6 ms-2">
                                        <input type="text" id="record_number" className="form-control"
                                               value={advancedRecord}
                                               onChange={e => setAdvancedRecord(e.target.value)}/>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="startDate">Begin date</label>
                                    <div className="col-md-2 ms-2">
                                        <input type="text" id="startDate" className="form-control"
                                               value={advancedBeginDate}
                                               onChange={e => setAdvancedBeginDate(e.target.value)}/>
                                    </div>
                                    <div className="col-md-6 text-start">
                                        <span className="small ms-2">(YYYY-MM-DD) leave blank for most recent record date</span>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center text-end">
                                    <label className="col-md-2 control-label" htmlFor="endDate">End date</label>
                                    <div className="col-md-2 ms-2">
                                        <input type="text" id="endDate" className="occurrence_date form-control"
                                               value={advancedEndDate}
                                               onChange={e => setAdvancedEndDate(e.target.value)}/>
                                    </div>
                                    <div className="col-md-6 text-start">
                                        <span className="small ms-2">(YYYY-MM-DD) leave blank for most recent record date </span>
                                    </div>
                                </div>

                                <div className="mb-3 row align-items-center">
                                    <div className="col-md-2 ms-3">
                                        <button className="btn btn-primary" onClick={() => advancedSearch()}>Search
                                        </button>
                                        <button id="clearAll" className="btn border-black ms-2"
                                                onClick={() => advancedClear()}>Clear all
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="taxon" title="Batch taxon search">
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="raw_names" className="fw-bold mb-1">Enter a list of taxon
                                        names/scientific names, one name
                                        per line (common names not currently supported).</label>
                                    <textarea id="raw_names" className="form-control" rows={15} cols={60}
                                              value={taxonText}
                                              onChange={e => setTaxonText(e.target.value)}>
                                </textarea>
                                </div>
                            </div>

                            <div className="mb-3 row">
                                <div className="col-sm-1">
                                    Search on:
                                </div>

                                <div className="col-sm-6">
                                    <div className="form-check">
                                        <input type="radio" name="field" id="batchModeMatched" value="taxa"
                                               checked={taxonMode === "taxa"} className="form-check-input"
                                               onChange={(e) => setTaxonMode(e.target.value)}/>
                                        <label className="form-check-label" htmlFor="batchModeMatched">
                                            Matched name&nbsp;
                                            <abbr
                                                title="Input names will be matched to their accepted scientific name in the ALA taxonomy. Results will include records for known synonyms">
                                                (via the ALA taxonomy)</abbr>
                                        </label>
                                    </div>
                                    <div className="form-check">
                                        <input type="radio" name="field" id="batchModeRaw"
                                               value="raw_scientificName" className="form-check-input"
                                               checked={taxonMode === "raw_scientificName"}
                                               onChange={(e) => setTaxonMode(e.target.value)}/>
                                        <label className="form-check-label" htmlFor="batchModeRaw">
                                            Supplied name&nbsp;
                                            <abbr
                                                title="Input names will only match the scientific name supplied in the original occurrence record. Results will NOT include records for known synonyms. Note: searching is case sensitive.">
                                                (note: is case-sensitive so genus should be
                                                capitalised)</abbr>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(taxonText, [taxonMode])}>Search
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="catalogue" title="Catalog number search">
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="catalogue_numbers" className="fw-bold mb-1">Enter a list of
                                        catalogue numbers (one number per
                                        line).</label>

                                    <textarea id="catalogue_numbers" className="form-control" rows={15}
                                              cols={60}
                                              value={catalogueText}
                                              onChange={e => setCatalogueText(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(catalogueText, ["catalogNumber"])}>Search
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Tab>
                    <Tab eventKey="event" title="Event search">
                        <div className="container-fluid">
                            <div className="mb-3 row align-items-center mt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">Search across event ID, parent
                                        event ID, field number and
                                        dataset / survey name.
                                    </label>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-8">
                                    <label className="fw-bold mb-1">
                                        Enter a list of terms (one per line).
                                    </label>

                                    <textarea id="event_keywords" className="form-control" rows={5}
                                              cols={60}
                                              value={eventTerms}
                                              onChange={e => setEventTerms(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(eventTerms, ["text_eventID", "text_parentEventID", "text_fieldNumber", "text_datasetName"])}>Search
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of event IDs (one
                                        per line).</label>
                                    <textarea id="event_ids" className="form-control" rows={5}
                                              cols={60}
                                              value={eventIds}
                                              onChange={e => setEventIds(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(eventIds, ["text_eventID"])}>Search
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of parent event IDs
                                        (one per
                                        line).</label>
                                    <textarea id="parent_event_ids" className="form-control" rows={5}
                                              cols={60}
                                              value={eventParentIds}
                                              onChange={e => setEventParentIds(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(eventParentIds, ["text_parentEventID"])}>Search
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">
                                    <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of field numbers
                                        (one per line).</label>
                                    <textarea name="queries" id="field_numbers" className="form-control" rows={5}
                                              cols={60}
                                              value={eventFieldNumbers}
                                              onChange={e => setEventFieldNumbers(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(eventFieldNumbers, ["text_fieldNumber"])}>Search
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3 row align-items-center pt-2">
                                <div className="col-sm-8">

                                    <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of dataset / survey
                                        names (one per
                                        line). </label>
                                    <textarea name="queries" id="dataset_name" className="form-control" rows={5}
                                              cols={60}
                                              value={eventNames}
                                              onChange={e => setEventNames(e.target.value)}></textarea>
                                </div>
                            </div>
                            <div className="mb-3 row align-items-center">
                                <div className="col-sm-2">
                                    <button className="btn btn-primary"
                                            onClick={() => batchSearch(eventNames, ["text_datasetName"])}>Search
                                    </button>
                                </div>
                            </div>
                        </div>

                    </Tab>
                    <Tab eventKey="spatial" title="Spatial search">
                        <div className="container-fluid">
                            <div className="mb-3 row">
                                <div className="col-sm-3 col-md-3 pe-3">
                                    <div>
                                        Select one of the draw tools (polygon, rectangle, circle), draw a shape and
                                        click the search link that pops up.
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
                                                    Import an existing GIS area
                                                </button>
                                            </h2>

                                            <div id="importAreaContent" className="accordion-collapse collapse">
                                                <div className="accordion-body">
                                                    <p>Import an existing GIS area (currently supported formats: <a
                                                        href="http://en.wikipedia.org/wiki/Well-known_text"
                                                        target="_blank">Well Known Text (WKT)</a> POLYGON shape)</p>
                                                    <p>To search with other spatial file formats (shapefile, KML, etc.),
                                                        please use the <a href="https://spatial.ala.org.au/">Spatial Portal</a> - via
                                                        the "Add to Map" ➜ "Areas" menu.
                                                    </p>

                                                    <p>Copy &amp; paste a WKT POLYGON string and click "Add to map":</p>
                                                    <textarea id="wktInput" style={{height: "280px", width: "95%"}}
                                                              value={spatialWkt}
                                                              onChange={e => setSpatialWkt(e.target.value)}></textarea>
                                                    <br/>
                                                    <button className="btn btn-primary btn-sm" id="addWkt" onClick={() => addWktToMap()}>
                                                        Add to map
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
                                            style={{
                                                height: '655px',
                                                borderRadius: '10px',
                                            }}
                                        >
                                            {!import.meta.env.VITE_GOOGLE_MAP_API_KEY &&
                                                <TileLayer
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    url={
                                                        import.meta
                                                            .env
                                                            .VITE_OPENSTREETMAP_ZXY_URL
                                                    }
                                                    zIndex={1}
                                                />
                                            }
                                            {import.meta.env
                                                .VITE_GOOGLE_MAP_API_KEY && (
                                                <LayersControl position="topright">
                                                    <LayersControl.BaseLayer
                                                        checked
                                                        name="Minimal"
                                                    >
                                                        <TileLayer
                                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                            url={
                                                                import.meta
                                                                    .env
                                                                    .VITE_OPENSTREETMAP_ZXY_URL
                                                            }
                                                            zIndex={1}
                                                        />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Road">
                                                        <ReactLeafletGoogleLayer
                                                            apiKey={
                                                                import.meta
                                                                    .env
                                                                    .VITE_GOOGLE_MAP_API_KEY
                                                            }
                                                            type={
                                                                'roadmap'
                                                            }
                                                        />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Terrain">
                                                        <ReactLeafletGoogleLayer
                                                            apiKey={
                                                                import.meta
                                                                    .env
                                                                    .VITE_GOOGLE_MAP_API_KEY
                                                            }
                                                            type={
                                                                'terrain'
                                                            }
                                                        />
                                                    </LayersControl.BaseLayer>
                                                    <LayersControl.BaseLayer name="Satellite">
                                                        <ReactLeafletGoogleLayer
                                                            apiKey={
                                                                import.meta
                                                                    .env
                                                                    .VITE_GOOGLE_MAP_API_KEY
                                                            }
                                                            type={
                                                                'satellite'
                                                            }
                                                        />
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
                                                                message: '<strong>Oh snap!</strong> you can\'t draw that!' // Message that will show when intersect
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
