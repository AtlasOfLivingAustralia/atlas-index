import {useEffect, useState} from "react";
import {AdvancedSearch, Breadcrumb} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import { Box, Button, Container, Divider, Grid, Group, MultiSelect, NativeSelect, rem, Space, Tabs, Text, TextInput, Title, useMantineTheme } from '@mantine/core';
// import {Menu, MenuItem, Typeahead} from "react-bootstrap-typeahead";
// import '../css/search.css';
import classes from '../desktop.module.css';
import { IconSearch } from "@tabler/icons-react";

function OccurrenceSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {
    const theme = useMantineTheme();
    const [tab, setTab] = useState('simple');
    const [advancedOptions, setAdvancedOptions] = useState<AdvancedSearch>();

    // simple search
    const [simpleTaxa, setSimpleTaxa] = useState('');

    // advanced search
    const [advancedText, setAdvancedText] = useState('');
    const [advancedTaxa, setAdvancedTaxa] = useState<any[]>([]);
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

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || ''; 
        setTab(tabsTab);
    };

    const handleTaxaInputChange = (index: number, value: string) => {
        const newAdvancedTaxa = [...advancedTaxa];
        newAdvancedTaxa[index] = value;
        setAdvancedTaxa(newAdvancedTaxa);
    };

    return <>
        <Box className={classes.header}>
            <Container py="lg" size="lg">
                <Title order={3} fw={400}>
                    <strong className="w-100" id="searchHeader">Search for records in Atlas of Living Australia</strong>
                </Title>
            </Container>
            <Tabs
                id="occurrence-tabs"
                defaultValue={tab}
                onChange={handleTabChange}
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
            <Space h="xl" />
            {tab === 'simple' && 
                <Box>
                    <Group style={{ display: 'flex', alignItems: 'center' }}>
                        <TextInput
                            value={simpleTaxa}
                            size="md"
                            mt="md"
                            style={{ width: '70%' }} 
                            onChange={(e) => setSimpleTaxa(e.target.value)}
                            placeholder="Enter species/taxon"
                            rightSectionWidth="auto"
                            leftSection={<IconSearch style={{ width: rem(18), height: rem(18) }} stroke={1.5} />}
                            rightSection={
                                <Button
                                    size="compact-md"
                                    variant="filled"
                                    px={10} mx={5}
                                    fullWidth
                                    onClick={() => simpleSearch()}
                                    >Search</Button>
                            }
                        />
                    </Group>
                    <Space h="xl" />
                    <Box>
                        <span className="simpleSearchNote">
                            <b>Note:</b> the simple search attempts to match a known <b>species/taxon</b> - by its scientific name or common name. If there are no name matches, a <b>full text</b> search will be performed on your query
                        </span>
                    </Box>
                </Box>
            }
            {tab === 'advanced' && 
                <Box>
                    <Text fw={700} mt="lg" mb="sm">Find records that have</Text>
                    <Grid align="center">
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>ALL of these words (full text)</Text>
                        </Grid.Col>
                        <Grid.Col span={9}><TextInput 
                            style={{ width: '80%' }}  
                            value={advancedText}
                            onChange={e => setAdvancedText(e.target.value)}
                        /></Grid.Col>
                    </Grid>
                    <Text fw={700} mt="lg" mb="sm">Find records for ANY of the following taxa
                        (matched/processed taxon concepts)</Text>
                    {[...Array(4)].map((_, index) => (
                        <Grid align="center">
                            <Grid.Col span={3} style={{ textAlign: "right" }}>
                                <Text>Species/Taxon</Text>
                            </Grid.Col>
                            <Grid.Col span={9}><TextInput 
                                style={{ width: '80%' }}  
                                value={advancedTaxa[index]}
                                onChange={e => handleTaxaInputChange(index, e.target.value)}
                            /></Grid.Col>
                        </Grid>
                    ))}
                    <Text fw={700} mt="lg" mb="sm">Find records that specify the following fields</Text>
                    <Grid align="center">
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>ALL of these words (full text)</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                            style={{ width: '80%' }}  
                            value={advancedText}
                            onChange={e => setAdvancedText(e.target.value)}
                            />
                        </Grid.Col>
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Provided scientific name</Text>
                        </Grid.Col>
                        <Grid.Col span={9}><TextInput 
                            style={{ width: '80%' }}  
                            value={advancedRawTaxon}
                            onChange={e => setAdvancedRawTaxon(e.target.value)}
                        />
                        </Grid.Col>
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Species group</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedSpeciesGroup}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedSpeciesGroup(e.currentTarget.value)}
                                >
                                <option value="">-- select a species group --</option>
                                {advancedOptions?.speciesGroups && advancedOptions.speciesGroups.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Institution or collection</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedInstitution}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedInstitution(e.currentTarget.value)}
                                >
                                <option value="">-- select an institution or collection --</option>
                                {advancedOptions?.institutions && advancedOptions.institutions.map((institution, idx) =>
                                    <optgroup key={idx} label={institution.name}>
                                        {institution.collections.map((collection, idx) =>
                                            <option key={idx} value={collection.fq}>{collection.name}</option>
                                        )}
                                    </optgroup>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Country</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedCountry(e.currentTarget.value)}
                                >
                                <option value="">-- select a country --</option>
                                {advancedOptions?.countries && advancedOptions.countries.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>State/Territory</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedState(e.currentTarget.value)}
                                >
                                <option value="">-- select a state/territory --</option>
                                {advancedOptions?.states && advancedOptions.states.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>
                    
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text><abbr title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr> region</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedIbra(e.currentTarget.value)}
                                >
                                <option value="">-- select an IBRA region --</option>
                                {advancedOptions?.ibra && advancedOptions.ibra.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>
                    
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text><abbr title="Integrated Marine and Coastal Regionalisation of Australia">IMCRA</abbr> region</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedImcra(e.currentTarget.value)}
                                >
                                <option value="">-- select an IBRA region --</option>
                                {advancedOptions?.imcra && advancedOptions.imcra.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Local Govt. Area</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedLga(e.currentTarget.value)}
                                >
                                <option value="">-- select a local government area --</option>
                                {advancedOptions?.lga && advancedOptions.lga.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Type status</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedTypeStatus}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedTypeStatus(e.currentTarget.value)}
                                >
                                <option value="">-- select a type status --</option>
                                {advancedOptions?.typeStatus && advancedOptions.typeStatus.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Basis of record</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedBasisOfRecord}
                                style={{ width: '80%' }}
                                onChange={(e) => setAdvancedBasisOfRecord(e.currentTarget.value)}
                                >
                                <option value="">-- select a basis of record --</option>
                                {advancedOptions?.basisOfRecord && advancedOptions.basisOfRecord.map((item, idx) =>
                                    <option key={idx} value={item.fq}>{item.name}</option>
                                )}
                            </NativeSelect>
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Collector name</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                                style={{ width: '80%' }}  
                                value={advancedCollector}
                                onChange={e => setAdvancedCollector(e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Data Resource</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <MultiSelect
                                data={advancedOptions?.dataResources as any[]}
                                value={advancedDataResource}
                                onChange={(selected) => {
                                    setAdvancedDataResource(selected)
                                }}
                                searchable
                                placeholder="Search or select a data resource"
                                style={{ width: '80%' }}  
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Catalogue number</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                                style={{ width: '80%' }}  
                                value={advancedCatalogue}
                                onChange={e => setAdvancedCatalogue(e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Record number</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                                style={{ width: '80%' }}  
                                value={advancedRecord}
                                onChange={e => setAdvancedRecord(e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Begin date</Text>
                        </Grid.Col>
                        <Grid.Col span="auto">
                            <TextInput 
                                style={{ width: '100%' }}  
                                value={advancedBeginDate}
                                onChange={e => setAdvancedBeginDate(e.target.value)}
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Text>(YYYY-MM-DD)</Text>
                        </Grid.Col>
                    </Grid>
                    <Grid align="center">  
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>End date</Text>
                        </Grid.Col>
                        <Grid.Col span="auto">
                            <TextInput 
                                style={{ width: '100%' }}  
                                value={advancedEndDate}
                                onChange={e => setAdvancedEndDate(e.target.value)}
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Text>(YYYY-MM-DD)</Text>
                        </Grid.Col>
                    </Grid>

                    <Group mt="lg">
                        <Button
                            size="md"
                            variant="filled"
                            onClick={() => advancedSearch()}
                            >Search</Button>
                        <Button
                            size="md"
                            variant="outline"
                            onClick={() => advancedClear()}
                            >Clear all</Button>
                    </Group>
                </Box>
            }
            {/* </Tabs.Panel> 
            <Tabs.Panel value="taxon" title="Batch taxon search"> */}
            {tab === 'taxon' && 
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
        }
            {/* </Tabs.Panel> 
            <Tabs.Panel value="catalogue" title="Catalog number search"> */}
            {tab === 'catalogue' && 
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
            }
            {/* </Tabs.Panel> 
            <Tabs.Panel value="event" title="Event search"> */}
            {tab === 'event' &&
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
            }
            {/* </Tabs.Panel> 
            <Tabs.Panel value="spatial" title="Spatial search"> */}
            {tab === 'spatial' &&
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
            }
            {/* </Tabs.Panel>  */}
        </Container>
    </>
}

export default OccurrenceSearch;
