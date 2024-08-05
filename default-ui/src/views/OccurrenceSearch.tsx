import {useEffect, useState} from "react";
import {AdvancedSearch, Breadcrumb} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import { Box, Container, Divider, Tabs, Title } from '@mantine/core';
// import {Menu, MenuItem, Typeahead} from "react-bootstrap-typeahead";
import '../css/search.css';

function OccurrenceSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [tab, setTab] = useState('simple');
    const [advancedOptions, setAdvancedOptions] = useState<AdvancedSearch>();

    // simple search
    const [simpleTaxa, setSimpleTaxa] = useState('');

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

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Occurrence Search', href: '/occurrence-search'},
        ]);

        fetch(import.meta.env.VITE_APP_ADVANCED_SEARCH_URL)
            .then(response => response.json())
            .then(data => {
                setAdvancedOptions(data)
            });
    }, []);

    function simpleSearch() {
        console.log(simpleTaxa);
    }

    function advancedSearch() {
        console.log('advanced search');
    }

    function advancedClear() {
        console.log('clear advanced search');
    }

    function taxonSearch() {
        console.log('taxon search');
    }

    function catalogueSearch() {
        console.log('catalogue search');
    }

    function eventTermsSearch() {
        console.log('event terms search');
    }

    function eventIdsSearch() {
        console.log('event ids search');
    }

    function eventParentIdsSearch() {
        console.log('event parent ids search');
    }

    function eventFieldNumbersSearch() {
        console.log('event field numbers search');
    }

    function eventNamesSearch() {
        console.log('event names search');
    }

    function importWkt() {
        console.log('import wkt');
        alert('import wkt')
    }

    return <>
        <Box>
            <Container size="lg">
                <Title order={3} fw={400}>
                    <strong className="w-100" id="searchHeader">Search for records in Atlas of Living Australia</strong>
                </Title>
            </Container>
            <Tabs
                id="occurrence-tabs"
                defaultValue={tab}
                className=""
            >
                <Container size="lg">
                    <Tabs.List>
                        <Tabs.Tab value="simple">Simple search</Tabs.Tab>
                        <Tabs.Tab value="advanced">Advanced search</Tabs.Tab>
                        <Tabs.Tab value="taxon">Taxon search</Tabs.Tab>
                        <Tabs.Tab value="catalogue">Catalogue search</Tabs.Tab>
                        <Tabs.Tab value="event">Event search</Tabs.Tab>
                        <Tabs.Tab value="spatial">Spatial search</Tabs.Tab>
                    </Tabs.List>  
                    <Divider mt={-1} />  
                </Container>
            </Tabs>
        </Box>
        <Container size="lg">
            <Tabs.Panel value="simple" title="Simple search">
                <div className="container-fluid ps-0">
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-9 col-md-9">
                            <div className="input-group">
                                <input type="text" className="form-control"
                                    value={simpleTaxa}
                                    onChange={e => setSimpleTaxa(e.target.value)}/>
                                <button className="btn btn-primary" onClick={() => simpleSearch()}>Search</button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <span className="simpleSearchNote">
                            <b>Note:</b> the simple search attempts to match a known <b>species/taxon</b> - by its scientific name or common name. If there are no name matches, a <b>full text</b> search will be performed on your query
                        </span>
                    </div>
                </div>
            </Tabs.Panel> 
            <Tabs.Panel value="advanced" title="Advanced search">
                <div className="container-fluid ps-0">
                    <h4>Find records that have</h4>
                    <div className="mb-3 row align-items-center text-end align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="text">ALL of these words (full
                            text)</label>
                        <div className="col-md-6">
                            <input type="text" className="dataset form-control"
                                value={advancedText}
                                onChange={e => setAdvancedText(e.target.value)}/>
                        </div>
                    </div>

                    <h4>Find records for ANY of the following taxa
                        (matched/processed taxon concepts)</h4>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="taxa_1">Species/Taxon</label>
                        <div className="col-md-6">
                            <input type="text" id="taxa_1" className="name_autocomplete form-control"
                                value={advancedTaxa1}
                                onChange={e => setAdvancedTaxa1(e.target.value)}/>
                        </div>
                    </div>


                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="taxa_2">Species/Taxon</label>
                        <div className="col-md-6">
                            <input type="text" id="taxa_2" className="name_autocomplete form-control"
                                value={advancedTaxa2}
                                onChange={e => setAdvancedTaxa2(e.target.value)}/>
                        </div>
                    </div>


                    <div className="mb-3 row align-items-center text-end" id="taxon_row_3">
                        <label className="col-md-2 control-label" htmlFor="taxa_3">Species/Taxon</label>
                        <div className="col-md-6">
                            <input type="text" id="taxa_3" className="name_autocomplete form-control"
                                value={advancedTaxa3}
                                onChange={e => setAdvancedTaxa3(e.target.value)}/>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end" id="taxon_row_4">
                        <label className="col-md-2 control-label" htmlFor="taxa_4">Species/Taxon</label>
                        <div className="col-md-6">
                            <input type="text" id="taxa_4" className="name_autocomplete form-control"
                                value={advancedTaxa4}
                                onChange={e => setAdvancedTaxa4(e.target.value)}/>
                        </div>
                    </div>

                    <h4 className="margin-bottom-half-1">Find records that specify the following fields</h4>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="raw_taxon_name">Provided scientific
                            name</label>
                        <div className="col-md-6">
                            <input type="text" id="raw_taxon_name" className="dataset form-control"
                                value={advancedRawTaxon}
                                onChange={e => setAdvancedRawTaxon(e.target.value)}/>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="species_group">Species group</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="species_group"
                                    value={advancedSpeciesGroup}
                                    onChange={e => setAdvancedSpeciesGroup(e.target.value)}>
                                <option value="">-- select a species group --</option>
                                {advancedOptions?.speciesGroups && advancedOptions.speciesGroups.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="institution_collection">Institution
                            or collection</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="institution_collection"
                                    value={advancedInstitution}
                                    onChange={e => setAdvancedInstitution(e.target.value)}>
                                <option value="">-- select an institution or collection --</option>

                                {advancedOptions?.institutions && advancedOptions.institutions.map((institution, idx) =>
                                    <optgroup key={idx} label={institution.name}>
                                        {institution.collections.map((collection, idx) =>
                                            <option key={idx} value={collection.fq}>{collection.name}</option>
                                        )}
                                    </optgroup>
                                )}

                            </select>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="country">Country</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="country"
                                    value={advancedCountry}
                                    onChange={e => setAdvancedCountry(e.target.value)}>
                                <option value="">-- select a country --</option>

                                {advancedOptions?.countries && advancedOptions.countries.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="state">State/Territory</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="state"
                                    value={advancedState}
                                    onChange={e => setAdvancedState(e.target.value)}>
                                <option value="">-- select a state/territory --</option>

                                {advancedOptions?.states && advancedOptions.states.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="ibra"><abbr
                            title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr> region</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="ibra"
                                    value={advancedIbra}
                                    onChange={e => setAdvancedIbra(e.target.value)}>
                                <option value="">-- select an IBRA region --</option>

                                {advancedOptions?.ibra && advancedOptions.ibra.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>
                        </div>
                    </div>


                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="imcra"><abbr
                            title="Integrated Marine and Coastal Regionalisation of Australia">IMCRA</abbr> region</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="imcra"
                                    value={advancedImcra}
                                    onChange={e => setAdvancedImcra(e.target.value)}>
                                <option value="">-- select an IMCRA region --</option>

                                {advancedOptions?.imcra && advancedOptions.imcra.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>
                        </div>
                    </div>


                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="lga">Local Govt. Area</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="lga"
                                    value={advancedLga}
                                    onChange={e => setAdvancedLga(e.target.value)}>
                                <option value="">-- select local government area--</option>

                                {advancedOptions?.lga && advancedOptions.lga.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>
                        </div>
                    </div>


                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="type_status">Type status</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="type_status"
                                    value={advancedTypeStatus}
                                    onChange={e => setAdvancedTypeStatus(e.target.value)}>
                                <option value="">-- select a type status --</option>

                                {advancedOptions?.typeStatus && advancedOptions.typeStatus.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>

                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="basis_of_record">Basis of
                            record</label>
                        <div className="col-md-6">
                            <select className="form-select form-control" id="basis_of_record"
                                    value={advancedBasisOfRecord}
                                    onChange={e => setAdvancedBasisOfRecord(e.target.value)}>
                                <option value="">-- select a basis of record --</option>

                                {advancedOptions?.basisOfRecord && advancedOptions.basisOfRecord.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}

                            </select>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="collector_text">Collector
                            name</label>
                        <div className="col-md-6">
                            <input type="text" id="collector_text" className="dataset form-control"
                                value={advancedCollector}
                                onChange={e => setAdvancedCollector(e.target.value)}/>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="control-label col-md-2">Data Resource</label>
                        <div className="col-md-6">
                            {/* {advancedOptions?.dataResources && <Typeahead
                                id="dataResource-autocomplete"
                                labelKey="name"
                                options={advancedOptions.dataResources}
                                selected={advancedDataResource}
                                onChange={(selected) => {
                                    setAdvancedDataResource(selected)
                                }}
                                renderMenu={(results, menuProps) => ( */}
                                    {/* <Menu {...menuProps}>
                                        {results.map((result, index) => (
                                            <MenuItem
                                                key={index}
                                                option={result}
                                                position={index}
                                                // Override href with the current route so clicking on an item does not change the route and the page does not scroll.
                                                href={"javascript:"}>
                                                {/* @ts-ignore */}
                                                {/* {result.name} */}
                                            {/* </MenuItem> */}
                                        {/* ))} */}
                                    {/* </Menu>  */}
                                {/* )}
                            />
                            } */}
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="catalogue_number">Catalogue
                            number</label>
                        <div className="col-md-6">
                            <input type="text" id="catalogue_number" className="form-control"
                                value={advancedCatalogue}
                                onChange={e => setAdvancedCatalogue(e.target.value)}/>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="record_number">Record
                            number</label>
                        <div className="col-md-6">
                            <input type="text" id="record_number" className="form-control"
                                value={advancedRecord}
                                onChange={e => setAdvancedRecord(e.target.value)}/>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="startDate">Begin date</label>
                        <div className="col-md-2 ">
                            <input type="text" id="startDate" className="form-control"
                                value={advancedBeginDate}
                                onChange={e => setAdvancedBeginDate(e.target.value)}/>
                        </div>
                        <div className="col-md-6 text-start">
                            <span className="small">(YYYY-MM-DD) leave blank for most recent record date</span>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center text-end">
                        <label className="col-md-2 control-label" htmlFor="endDate">End date</label>
                        <div className="col-md-2 ">
                            <input type="text" id="endDate" className="occurrence_date form-control"
                                value={advancedEndDate}
                                onChange={e => setAdvancedEndDate(e.target.value)}/>
                        </div>
                        <div className="col-md-6 text-start">
                            <span className="small">(YYYY-MM-DD) leave blank for most recent record date </span>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <div className="col-md-2">
                            <button className="btn btn-primary" onClick={() => advancedSearch()}>Search</button>
                            <button id="clearAll" className="btn border-black ms-2"
                                    onClick={() => advancedClear()}>Clear all
                            </button>
                        </div>
                    </div>
                </div>
            </Tabs.Panel> 
            <Tabs.Panel value="taxon" title="Batch taxon search">
                <div className="container-fluid ps-0">
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="raw_names" className="fw-bold mb-1">Enter a list of taxon names/scientific names, one name
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
                            <button className="btn btn-primary" onClick={() => taxonSearch()}>Search</button>
                        </div>
                    </div>
                </div>
            </Tabs.Panel> 
            <Tabs.Panel value="catalogue" title="Catalog number search">
                <div className="container-fluid ps-0">
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="catalogue_numbers" className="fw-bold mb-1">Enter a list of catalogue numbers (one number per
                                line).</label>

                            <textarea id="catalogue_numbers" className="form-control" rows={15}
                                    cols={60}
                                    value={catalogueText}
                                    onChange={e => setCatalogueText(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-2">
                            <button className="btn btn-primary" onClick={() => catalogueSearch()}>Search</button>
                        </div>
                    </div>
                </div>
            </Tabs.Panel> 
            <Tabs.Panel value="event" title="Event search">
                <div className="container-fluid ps-0">
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="event_ids" className="fw-bold mb-1">Search across event ID, parent event ID, field number and
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
                            <button className="btn btn-primary" onClick={() => eventTermsSearch()}>Search</button>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of event IDs (one per line).</label>
                            <textarea id="event_ids" className="form-control" rows={5}
                                    cols={60}
                                    value={eventIds}
                                    onChange={e => setEventIds(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-2">
                            <button className="btn btn-primary" onClick={() => eventIdsSearch()}>Search</button>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of parent event IDs (one per
                                line).</label>
                            <textarea id="parent_event_ids" className="form-control" rows={5}
                                    cols={60}
                                    value={eventParentIds}
                                    onChange={e => setEventParentIds(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-2">
                            <button className="btn btn-primary" onClick={() => eventParentIdsSearch()}>Search</button>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">
                            <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of field numbers (one per line).</label>
                            <textarea name="queries" id="field_numbers" className="form-control" rows={5}
                                    cols={60}
                                    value={eventFieldNumbers}
                                    onChange={e => setEventFieldNumbers(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-2">
                            <button className="btn btn-primary" onClick={() => eventFieldNumbersSearch()}>Search</button>
                        </div>
                    </div>

                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-8">

                            <label htmlFor="event_ids" className="fw-bold mb-1">Enter a list of dataset / survey names (one per
                                line). </label>
                            <textarea name="queries" id="dataset_name" className="form-control" rows={5}
                                    cols={60}
                                    value={eventNames}
                                    onChange={e => setEventNames(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="mb-3 row align-items-center">
                        <div className="col-sm-2">
                            <button className="btn btn-primary" onClick={() => eventNamesSearch()}>Search</button>
                        </div>
                    </div>
                </div>

            </Tabs.Panel> 
            <Tabs.Panel value="spatial" title="Spatial search">
                <div className="container-fluid ps-0">
                    <div className="mb-3 row">
                        <div className="col-sm-3 col-md-3">
                            <div>
                                Select one of the draw tools (polygon, rectangle, circle), draw a shape and click
                                the
                                search link that pops up.
                            </div>
                            <br/>

                            <div className="panel-group panel-group-caret" id="importAreaPanel">
                                <div className="panel panel-default">
                                    <div className="panel-heading">
                                        <div className="panel-group-toggle collapsed" data-toggle="collapse"
                                        data-parent="#importAreaPanel" onClick={() => importWkt()}>
                                            Import an existing GIS area
                                        </div>
                                    </div>

                                    <div id="importAreaContent" className="panel-collapse">
                                        <div className="panel-body">
                                            <p>Import an existing GIS area (currently supported formats: <a
                                                href="http://en.wikipedia.org/wiki/Well-known_text" target="_blank">Well
                                                Known Text (WKT)</a> POLYGON shape)</p>

                                            <p>To search with other spatial file formats (shapefile, KML, etc.),
                                                please
                                                use the <a href="https://spatial.ala.org.au/">Spatial Portal</a> -
                                                via
                                                the "Add to Map" ➜ "Areas" menu.
                                            </p>

                                            <p>Copy &amp; paste a WKT POLYGON string and click "Add to map":</p>
                                            <textarea id="wktInput" style={{height: "280px", width: "95%"}}
                                                    value={spatialWkt}
                                                    onChange={e => setSpatialWkt(e.target.value)}></textarea>
                                            <br/>
                                            <button className="btn btn-primary btn-sm" id="addWkt">Add to map
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-sm-9 col-md-9">
                            <div id="leafletMap" style={{height: "600px", position: "relative"}}>
                            </div>
                        </div>
                    </div>
                </div>
            </Tabs.Panel> 
        </Container>
    </>
}

export default OccurrenceSearch;
