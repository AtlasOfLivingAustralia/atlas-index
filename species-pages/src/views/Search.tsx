import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import {Link} from "react-router-dom";
import { rem, Box, Button, Center, Container, Flex, Group, Input, Space, Tabs, Text, TextInput, Title, Anchor, List, Divider } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import classes from "./search.module.css";
import { CloseIcon, SearchIcon, AllIcon, SpeciesIcon, DatasetsIcon, SpeciesListsIcon, DataProjectsIcon, EnvironmentalLayersIcon, RegionsIcon, ALAGeneralContentIcon, HelpArticlesIcon} from '@atlasoflivingaustralia/ala-mantine';
import MapView from "../components/species/mapView.tsx";
import ClassificationView from "../components/species/classificationView.tsx";
import DescriptionView from "../components/species/descriptionView.tsx";
import ImagesView from "../components/species/imagesView.tsx";
import NamesView from "../components/species/namesView.tsx";
import StatusView from "../components/species/statusView.tsx";
import TraitsView from "../components/species/traitsView.tsx";
import DatasetsView from "../components/species/datasetsView.tsx";
import ResourcesView from "../components/species/resourcesView.tsx";
import AllView from "../components/search/allView.tsx";

function Search({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    const [queryResult, setQueryResult] = useState('');
    const [tab, setTab] = useState('all');

    const currentUser = useContext(UserContext) as ListsUser;

    useEffect(() => {
        setBreadcrumbs([
        ]);
    }, [currentUser]);

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
                           queryResult={queryResult}
                           onChange={(event) => setQueryResult(event.currentTarget.value)} />
                        <Box style={{marginLeft: "-14px", marginTop: "12px", zIndex: "100", cursor: "pointer"}}><CloseIcon style={{marginLeft: "-30px"}} /></Box>
                        <Button variant="filled" color="blue" className={classes.searchButton}><SearchIcon style={{marginTop: "-2px"}}/></Button>
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
                                <Tabs.Tab value="all"><AllIcon />All</Tabs.Tab>
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
                <Container size="lg">
                    <Space h="px30" />
                    {tab === 'all' &&
                        <AllView queryString={queryResult}/>
                    }
                    <Space h="60px" />
                </Container>
            </Container>
        </>
    );
}

export default Search;
