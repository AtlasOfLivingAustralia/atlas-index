import { useEffect, useState } from "react";
import { AdvancedSearch, AdvancedSearchInputs, Breadcrumb } from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import { Accordion, Anchor, Box, Button, Code, Container, Divider, Flex, Grid, 
    Group, NativeSelect, Radio, rem, Select, Space, Stack, Tabs, Text, Textarea, 
    TextInput, Title, useMantineTheme } from '@mantine/core';
// import {Menu, MenuItem, Typeahead} from "react-bootstrap-typeahead";
// import '../css/search.css';
import classes from '../App.module.css';
import { IconSearch } from "@tabler/icons-react";

function OccurrenceSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {
    // const theme = useMantineTheme();
    const [tab, setTab] = useState('simple');
    const [advancedOptions, setAdvancedOptions] = useState<AdvancedSearch>();

    // simple search
    const [simpleTaxa, setSimpleTaxa] = useState('');

    // advanced search
    const [advancedSearchInputs, setAdvancedSearchInputs] = useState<AdvancedSearchInputs>({
        advancedText: '',
        advancedTaxa: [],
        advancedRawTaxon: '',
        advancedSpeciesGroup: '',
        advancedInstitution: '',
        advancedCountry: '',
        advancedState: '',
        advancedIbra: '',
        advancedImcra: '',
        advancedLga: '',
        advancedTypeStatus: '',
        advancedBasisOfRecord: '',
        advancedDataResource: '',
        advancedCollector: '',
        advancedCatalogue: '',
        advancedRecord: '',
        advancedBeginDate: '',
        advancedEndDate: '',
    });

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
        setAdvancedSearchInputs({
            advancedText: '',
            advancedTaxa: [],
            advancedRawTaxon: '',
            advancedSpeciesGroup: '',
            advancedInstitution: '',
            advancedCountry: '',
            advancedState: '',
            advancedIbra: '',
            advancedImcra: '',
            advancedLga: '',
            advancedTypeStatus: '',
            advancedBasisOfRecord: '',
            advancedDataResource: null, // Needed for Select component "reset"
            advancedCollector: '',
            advancedCatalogue: '',
            advancedRecord: '',
            advancedBeginDate: '',
            advancedEndDate: '',
        });
    }
    
    function taxonSearch() {
        console.log('taxon search');
    }

    function taxonClear() {
        console.log('clear taxon search');
        setTaxonText('');
    }

    function catalogueSearch() {
        console.log('catalogue search');
    }

    function catalogueClear() {
        console.log('clear catalogue search');
        setCatalogueText('');
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

    const handleAdvancedInputChange = (field: keyof AdvancedSearchInputs, value: any) => {
        setAdvancedSearchInputs(prevState => ({
            ...prevState,
            [field]: value,
        }));
    };

    return <>
        <Box className={classes.header}>
            <Container py="lg" size="lg">
                <Title order={3} fw={500}>
                    Search for records in Atlas of Living Australia
                </Title>
            </Container>
            <Tabs
                id="occurrence-tabs"
                value={tab}
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
                            style={{ width: '80%' }} 
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
                        <Text style={{ width: '80%' }} >
                            <b>Note:</b> the simple search attempts to match a known <b>species/taxon</b> - by its scientific name or common name. If there are no name matches, a <b>full text</b> search will be performed on your query
                        </Text>
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
                            value={advancedSearchInputs.advancedText}
                            onChange={e => handleAdvancedInputChange('advancedText', e.target.value)}
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
                                value={advancedSearchInputs.advancedTaxa[index] || ''}
                                onChange={e => {
                                    const newAdvancedTaxa = [...advancedSearchInputs.advancedTaxa];
                                    newAdvancedTaxa[index] = e.target.value;
                                    handleAdvancedInputChange('advancedTaxa', newAdvancedTaxa);
                                }}
                            /></Grid.Col>
                        </Grid>
                    ))}
                    <Text fw={700} mt="lg" mb="sm">Find records that specify the following fields</Text>
                    <Grid align="center">
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Provided scientific name</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                                style={{ width: '80%' }}  
                                value={advancedSearchInputs.advancedRawTaxon}
                                onChange={e => handleAdvancedInputChange('advancedRawTaxon', e.target.value)}
                            />
                        </Grid.Col>
                        
                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Species group</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <NativeSelect
                                value={advancedSearchInputs.advancedSpeciesGroup}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedSpeciesGroup', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedInstitution}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedInstitution', e.currentTarget.value)}
                            >
                                <option value="">-- select an institution or collection --</option>
                                {advancedOptions?.institutions && advancedOptions.institutions.map((institution, idx) =>
                                    <optgroup key={idx} label={institution.name}>
                                        {institution.collections.map((collection, ndx) =>
                                            <option key={ndx} value={collection.fq}>{collection.name}</option>
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
                                value={advancedSearchInputs.advancedCountry}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedCountry', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedState}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedState', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedIbra}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedIbra', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedImcra}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedImcra', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedLga}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedLga', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedTypeStatus}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedTypeStatus', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedBasisOfRecord}
                                style={{ width: '80%' }}
                                onChange={(e) => handleAdvancedInputChange('advancedBasisOfRecord', e.currentTarget.value)}
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
                                value={advancedSearchInputs.advancedCollector}
                                onChange={e => handleAdvancedInputChange('advancedCollector', e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Data Resource</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <Select
                                data={advancedOptions?.dataResources?.map((dr) => dr.fq)}
                                value={advancedSearchInputs.advancedDataResource}
                                onChange={(selected) => {
                                    handleAdvancedInputChange('advancedDataResource', selected)
                                }}
                                searchable allowDeselect
                                maxDropdownHeight={200}
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
                                value={advancedSearchInputs.advancedCatalogue}
                                onChange={e => handleAdvancedInputChange('advancedCatalogue', e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Record number</Text>
                        </Grid.Col>
                        <Grid.Col span={9}>
                            <TextInput 
                                style={{ width: '80%' }}  
                                value={advancedSearchInputs.advancedRecord}
                                onChange={e => handleAdvancedInputChange('advancedRecord', e.target.value)}
                            />
                        </Grid.Col>

                        <Grid.Col span={3} style={{ textAlign: "right" }}>
                            <Text>Begin date</Text>
                        </Grid.Col>
                        <Grid.Col span="auto">
                            <TextInput 
                                style={{ width: '100%' }}  
                                value={advancedSearchInputs.advancedBeginDate}
                                onChange={e => handleAdvancedInputChange('advancedBeginDate', e.target.value)}
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
                                value={advancedSearchInputs.advancedEndDate}
                                onChange={e => handleAdvancedInputChange('advancedEndDate', e.target.value)}
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

            {tab === 'taxon' && 
                <Box>
                    <Text fw={500}>Enter a list of taxon names/scientific names, one name per line</Text>
                    <Textarea
                        style={{ width: '80%' }}
                        mt="sm"
                        value={taxonText}
                        onChange={e => setTaxonText(e.target.value)}
                        autosize={true}
                        minRows={10}
                        maxRows={15} 
                    />
                    <Flex align="flex-start" justify="flex-start" mt="md" gap="sm">
                        <Text>Search on:</Text>
                        <Stack>
                            <Radio.Group
                                value={taxonMode}
                                onChange={setTaxonMode}
                                name="taxonMode"
                            >
                                <Radio value="taxa" label="Matched name (via the ALA taxonomy)" />
                                <Radio mt="xs" value="raw_scientificName" label="Supplied name (note: is case-sensitive so genus should be capitalised)" />
                            </Radio.Group>
                        </Stack>
                    </Flex>
                    <Group mt="lg">
                        <Button
                            size="md"
                            variant="filled"
                            onClick={() => taxonSearch()}
                            >Search</Button>
                        <Button
                            size="md"
                            variant="outline"
                            onClick={() => taxonClear()}
                            >Clear</Button>
                    </Group>
                </Box>
            }

            {tab === 'catalogue' && 
                <Box>
                    <Text fw={500}>Enter a list of catalogue numbers, one number per line</Text>
                    <Textarea
                        style={{ width: '80%' }}
                        mt="sm"
                        value={catalogueText}
                        onChange={e => setCatalogueText(e.target.value)}
                        autosize={true}
                        minRows={10}
                        maxRows={15} 
                    />
                    <Group mt="lg">
                        <Button
                            size="md"
                            variant="filled"
                            onClick={() => catalogueSearch()}
                            >Search</Button>
                        <Button
                            size="md"
                            variant="outline"
                            onClick={() => catalogueClear()}
                            >Clear</Button>
                    </Group>
                </Box>
            }      
            
            {tab === 'event' &&
                <Box>
                    <Text fw={500}>Search across event ID, parent event ID, field number and dataset / survey name</Text>
                    {[
                        {
                            label: 'Enter a list of terms (one per line).',
                            id: 'event_keywords',
                            value: eventTerms,
                            setValue: setEventTerms,
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEventTerms(e.target.value),
                            search: eventTermsSearch,
                        },
                        {
                            label: 'Enter a list of event IDs (one per line).',
                            id: 'event_ids',
                            value: eventIds,
                            setValue: setEventIds,
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEventIds(e.target.value),
                            search: eventIdsSearch,
                        },
                        {
                            label: 'Enter a list of parent event IDs (one per line).',
                            id: 'parent_event_ids',
                            value: eventParentIds,
                            setValue: setEventParentIds,
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEventParentIds(e.target.value),
                            search: eventParentIdsSearch,
                        },
                        {
                            label: 'Enter a list of field numbers (one per line).',
                            id: 'field_numbers',
                            value: eventFieldNumbers,
                            setValue: setEventFieldNumbers,
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEventFieldNumbers(e.target.value),
                            search: eventFieldNumbersSearch,
                        },
                        {
                            label: 'Enter a list of dataset / survey names (one per line).',
                            id: 'dataset_name',
                            value: eventNames,
                            setValue: setEventNames,
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEventNames(e.target.value),
                            search: eventNamesSearch,
                        },
                    ].map((item, index) => (
                        <Box mt="md" key={index}>
                            <Text>{item.label}</Text>
                            <Textarea
                                style={{ width: '80%' }}
                                mt="xs" mb="xs"
                                value={item.value}
                                onChange={item.onChange}
                                autosize={true}
                                minRows={5} maxRows={5} 
                            />
                            <Group>
                                <Button
                                    size="compact-md"
                                    variant="filled"
                                    onClick={item.search}
                                    >Search</Button>
                                <Button
                                    size="compact-md"
                                    variant="outline"
                                    onClick={() => {item.setValue('')}}
                                    >Clear</Button>
                            </Group>
                            <Divider mt="md" style={{ width: '80%' }}/>
                        </Box>
                    ))}
                </Box>
            }
            
            {tab === 'spatial' &&
                <Grid>
                    <Grid.Col span={3}>
                        <Text>
                            Select one of the draw tools (polygon, rectangle, circle), draw a shape and click
                            the search link that pops up.
                        </Text>
                        <Accordion mt="md">
                            <Accordion.Item value="1">
                                <Accordion.Control>
                                    Import an existing GIS area
                                </Accordion.Control>
                                <Accordion.Panel mt="sm">
                                    <Text mt="sm">Import a GIS shape in <Anchor
                                        href="http://en.wikipedia.org/wiki/Well-known_text" target="_blank">Well
                                        Known Text (WKT)</Anchor> format.</Text>
                                    <Text mt="sm" hidden>To search with other spatial file formats (shapefile, KML, etc.),
                                        please use the <Anchor href="https://spial.ala.org.au/">Spatial Portal</Anchor>
                                        - via the "Add to Map" ➜ "Areas" menu.
                                    </Text>
                                    <Text mt="sm">Copy &amp; paste a WKT string (e.g., <Code>POLYGON(...)</Code>):</Text>
                                    <Textarea 
                                        id="wktInput"  
                                        mt="sm" 
                                        // style={{height: "280px", width: "95%"}}                                            
                                        value={spatialWkt}
                                        onChange={e => setSpatialWkt(e.target.value)}
                                        autosize={true}
                                        minRows={7} maxRows={7} 
                                    ></Textarea>
                                    <Button mt="sm" mb="lg" variant="filled" size="compact-md" onClick={importWkt}>Add to map</Button>
                                </Accordion.Panel>
                            </Accordion.Item>
                        </Accordion>
                    </Grid.Col>
                    <Grid.Col span={9}>
                        <Box bg="gray.1">
                            <div id="leafletMap" style={{height: "600px", position: "relative"}} />
                        </Box>
                    </Grid.Col>
                </Grid>
            }
        </Container>
    </>
}

export default OccurrenceSearch;
