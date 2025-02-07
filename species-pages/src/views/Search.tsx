import React, {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {Accordion, Box, Button, Center, Container, Flex, Space, Tabs, Text, TextInput} from "@mantine/core";
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

    const panels = [
        { id: 'all', icon: <AllIcon/>, title: 'All', component: <AllView queryString={queryResult}/>},
        { id: 'species',icon: <SpeciesIcon/>, title: 'Species', component: <GenericView queryString={queryResult} props={speciesDefn}/>  },
        { id: 'datasets', icon: <DatasetsIcon />, title: 'Datasets', component: <GenericView queryString={queryResult} props={datasetsDefn}/> },
        { id: 'specieslists', icon: <SpeciesListsIcon />, title: 'Species lists', component: <GenericView queryString={queryResult} props={specieslistDefn} />},
        { id: 'dataprojects', icon: <DataProjectsIcon />, title: 'Data projects', component: <GenericView queryString={queryResult} props={dataprojectsDefn} /> },
        { id: 'environmentallayers', icon: <EnvironmentalLayersIcon />, title: 'Environmental layers', component: <GenericView queryString={queryResult} props={environmentallayersDefn} /> },
        { id: 'regionslocalities', icon: <RegionsIcon />, title: 'Regions/localities', component: <GenericView queryString={queryResult} props={regionslocalitiesDefn} />},
        { id: 'alageneralcontent', icon: <ALAGeneralContentIcon />, title: 'ALA general content', component: <GenericView queryString={queryResult} props={wordpressDefn} /> },
        { id: 'helparticles', icon: <HelpArticlesIcon />, title: 'Help articles', component: <GenericView queryString={queryResult} props={supportDefn} /> },
    ];

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
                        <Box style={{marginLeft: "-12px", marginTop: "12px", zIndex: "100", cursor: "pointer"}}>
                            <CloseIcon style={{marginLeft: "-10px"}} onClick={() => {setQueryResultValue(""); setQueryResult(""); }} />
                        </Box>
                        <Button style={{marginLeft: "10px"}} variant="filled" color="blue" className={classes.searchButton}
                                onClick={() => setQueryResult(queryResultValue)} >
                            <SearchIcon style={{marginTop: "-2px"}}/>
                        </Button>
                    </Flex>
                    <Space h="30px"/>
                </Box>


               <Accordion className={classes.mobile}
                   multiple // Optional: Allow multiple panels to be open at once
                   chevronPosition="left" // Chevron on the left for better UX
                   defaultValue={panels[0]?.id}
               >
                   {panels.map((panel) => (
                       <Accordion.Item value={panel.id} key={panel.id}>
                           <Accordion.Control>
                               {panel.icon} {panel.title}
                           </Accordion.Control>
                           <Accordion.Panel>{panel.component}</Accordion.Panel>
                       </Accordion.Item>
                   ))}
               </Accordion>

              <div className={classes.desktop}>
                <Flex justify="center" style={{backgroundColor: "#F2F2F2"}}>
                    <Tabs
                        id="occurrence-tabs"
                        value={tab}
                        onChange={handleTabChange} >
                        <Container size="responsive">
                            <Tabs.List className={classes.tabButtons}>
                                {panels.map((panel) => (
                                    <Tabs.Tab value={panel.id}> {panel.icon}{panel.title}</Tabs.Tab>
                                ))}
                            </Tabs.List>
                        </Container>
                    </Tabs>
                </Flex>
                <Container size="1280px">
                    <Space h="px30" />
                    {(panels.find(panel=>panel.id === tab)?.component || null)}
                    <Space h="60px" />
                </Container>
              </div>
            </Container>
        </>
    );
}

export default Search;
