import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import { Box, Button, Center, Container, Flex, Space, Tabs, Text, TextInput} from "@mantine/core";
import classes from "./search.module.css";
import { CloseIcon, SearchIcon, AllIcon, SpeciesIcon, DatasetsIcon, SpeciesListsIcon, DataProjectsIcon, EnvironmentalLayersIcon, RegionsIcon, ALAGeneralContentIcon, HelpArticlesIcon} from '@atlasoflivingaustralia/ala-mantine';
import AllView from "../components/search/allView.tsx";
import GenericView from "../components/search/genericView.tsx";
import {datasetsDefn} from "../components/search/props/datasetsDefn.tsx";
import {speciesDefn} from "../components/search/props/speciesDefn.tsx";
import {specieslistDefn} from "../components/search/props/specieslistDefn.tsx";
import {dataprojectsDefn} from "../components/search/props/dataprojectsDefn.tsx";
import {environmentallayersDefn} from "../components/search/props/environmentallayersDefn.tsx";
import {regionslocalitiesDefn} from "../components/search/props/regionslocalitiesDefn.tsx";
import {wordpressDefn} from "../components/search/props/wordpressDefn.tsx";
import {supportDefn} from "../components/search/props/supportDefn.tsx";

function Search({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    // the queryResultValue is the value of the search input box
    const [queryResultValue, setQueryResultValue] = useState<string>('');

    // the queryResult is used by the tabs to do the actual search and display the search results
    const [queryResult, setQueryResult] = useState<string>('');

    const [tab, setTab] = useState('all');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Species search', href: '/'},
            {title: 'Search', href: '/search'}
        ]);
    }, []);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    return (
        <>
            <Container fluid>
                <Box style={{backgroundColor: "#F2F2F2"}}>
                    <Space h="60px" />
                    <Center>
                        <Text className={classes.searchTitle}>Search Atlas of Living Australia</Text>
                    </Center>
                    <Space h="30px"/>
                    <Flex justify="center">
                        <TextInput placeholder="Search species, datasets, content and more..." className={classes.searchInput}
                           value={queryResultValue}
                           onChange={(event) => setQueryResultValue(event.currentTarget.value)}
                           onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                               if (event.key === 'Enter') {
                                   setQueryResultValue(event.currentTarget.value);
                                   setQueryResult(event.currentTarget.value);
                                   event.preventDefault();
                               }
                            }}
                        />
                        <Box style={{marginLeft: "-14px", marginTop: "12px", zIndex: "100", cursor: "pointer"}}>
                            <CloseIcon style={{marginLeft: "-30px"}} onClick={() => {setQueryResultValue(""); setQueryResult(""); }} />
                        </Box>
                        <Button variant="filled" color="blue" className={classes.searchButton}
                                onClick={() => setQueryResult(queryResultValue)} >
                            <SearchIcon style={{marginTop: "-2px"}}/>
                        </Button>
                    </Flex>
                    <Space h="30px"/>
                </Box>
                <Flex justify="center" style={{backgroundColor: "#F2F2F2"}}>
                    <Tabs
                        id="occurrence-tabs"
                        value={tab}
                        onChange={handleTabChange} >
                        <Container size="responsive">
                            <Tabs.List className={classes.tabButtons}>
                                <Tabs.Tab value="all"><AllIcon/>All</Tabs.Tab>
                                <Tabs.Tab value="species"><SpeciesIcon />Species</Tabs.Tab>
                                <Tabs.Tab value="datasets"><DatasetsIcon />Datasets</Tabs.Tab>
                                <Tabs.Tab value="specieslists"><SpeciesListsIcon />Species lists</Tabs.Tab>
                                <Tabs.Tab value="dataprojects"><DataProjectsIcon />Data projects</Tabs.Tab>
                                <Tabs.Tab value="environmentallayers"><EnvironmentalLayersIcon />Environmental layers</Tabs.Tab>
                                <Tabs.Tab value="regionslocalities"><RegionsIcon />Regions/localities</Tabs.Tab>
                                <Tabs.Tab value="alageneralcontent"><ALAGeneralContentIcon />ALA general content</Tabs.Tab>
                                <Tabs.Tab value="helparticles"><HelpArticlesIcon />Help articles</Tabs.Tab>
                            </Tabs.List>
                        </Container>
                    </Tabs>
                </Flex>
                <Container size="1280px">
                    <Space h="px30" />
                    {tab === 'all' && <AllView queryString={queryResult} setTab={setTab}/>}
                    {tab === 'species' && <GenericView queryString={queryResult} props={speciesDefn} />}
                    {tab === 'datasets' && <GenericView queryString={queryResult} props={datasetsDefn} />}
                    {tab === 'specieslists' && <GenericView queryString={queryResult} props={specieslistDefn} />}
                    {tab === 'dataprojects' && <GenericView queryString={queryResult} props={dataprojectsDefn} />}
                    {tab === 'environmentallayers' && <GenericView queryString={queryResult} props={environmentallayersDefn} />}
                    {tab === 'regionslocalities' && <GenericView queryString={queryResult} props={regionslocalitiesDefn} />}
                    {tab === 'alageneralcontent' && <GenericView queryString={queryResult} props={wordpressDefn} />}
                    {tab === 'helparticles' && <GenericView queryString={queryResult} props={supportDefn} />}
                    <Space h="60px" />
                </Container>
            </Container>
        </>
    );
}

export default Search;
