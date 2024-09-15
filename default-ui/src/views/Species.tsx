import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import MapView from "../components/species/mapView.tsx";
import ClassificationView from "../components/species/classificationView.tsx";
import DescriptionView from "../components/species/descriptionView.tsx";
import ImagesView from "../components/species/imagesView.tsx";
import NamesView from "../components/species/namesView.tsx";
import StatusView from "../components/species/statusView.tsx";
import TraitsView from "../components/species/traitsView.tsx";
import DatasetsView from "../components/species/datasetsView.tsx";
import ResourcesView from "../components/species/resourcesView.tsx";
import { Alert, Anchor, Box, Code, Container, Divider, Flex, Grid, Image, List, Space, Tabs, Text, Title } from "@mantine/core";
import { IconCircleFilled, IconFlagFilled } from "@tabler/icons-react";
import BreadcrumbSection from "../components/header/breadcrumbs.tsx";
import capitalizeFirstLetter from "../helpers/Capitalise.ts";
// import Breadcrumbs from "../components/breadcrumbs/breadcrumbs.tsx";

import classes from '../components/species/species.module.css';

function Species({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string
}) {
    const [tab, setTab] = useState('map');
    const [resultV2, setResultV2] = useState<Record<PropertyKey, string | number | any >>({});
    const [resultV1, setResultV1] = useState<Record<PropertyKey, string | number | any>>({});

    const [loadingV1, setLoadingV1] = useState<boolean>(true);
    const [loadingV2, setLoadingV2] = useState<boolean>(true);
    const [dataV1Fetched, setDataV1Fetched] = useState(false);
    const [dataV2Fetched, setDataV2Fetched] = useState(false);

    useEffect(() => {
        setBreadcrumbs([]); // Clear breadcrumbs so App.tsx doesn't show them
    }, []);

    const breadcrumbValues: Breadcrumb[] = [
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Default UI', href: '/'},
        {title: 'Species', href: '/species'},
    ];

    useEffect(() => {
        let request = [queryString?.split("=")[1]]
        setLoadingV2(true);
        setDataV1Fetched(false);
        setResultV2({});
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/species", {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('V2 error: ' + response.status);
            }
        })
        .then(data => {
            if (data[0] && data[0] !== null) {
                // Hard-code missing data TODO: remove
                data[0].conservationStatuses = [ true ]
                data[0].invasiveStatuses = [ true ]
                setResultV2(data[0])
            } 
        })
        .catch(error => {
            console.warn(error);
            // setResult({});
        })
        .finally(() => {   
            setLoadingV2(false);
            setDataV1Fetched(true);
        });

        setLoadingV1(true);
        setDataV1Fetched(false);
        setResultV1({});
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v1/species/" + request, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('V1 error: ' + response.status);
            }
        })
        .then(data => {
            if (data) {
                setResultV1(data);
            } 
        })
        .catch(error => {
            console.warn(error);
            // setResultV1({});
        })
        .finally(() => {
            setLoadingV1(false);
            setDataV2Fetched(true);
        });

    }, [queryString]);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || ''; 
        setTab(tabsTab);
    };

    // Scientific name is italicized if rank is between 6000 and 8000
    const fontStyle = (rankId: string |number) => {
        return (typeof rankId === 'number' && rankId <= 8000 && rankId >= 6000) ? 'italic' : 'normal';
    }

    const result = { ...resultV2, ...resultV1 }; 
    const haveCommonKeys = (obj1: Record<PropertyKey, string | number | any>, obj2: Record<PropertyKey, string | number | any>): boolean => {
        const keys1 = new Set(Object.keys(obj1));
        const keys2 = Object.keys(obj2);
        
        for (const key of keys2) {
            if (keys1.has(key)) {
                console.log("Found dupe key", key, resultV1.key, resultV2.key);
                return true;
            }
        }
        
        return false;
    }

    console.log("combinedResult", result, haveCommonKeys(resultV1, resultV2));
    // console.log("resultV1", resultV1);
    // console.log("resultV2", resultV2);

    if ((dataV1Fetched && dataV2Fetched) && Object.keys(result).length === 0) {
        return (
            <>
                <Box className={classes.speciesHeader}>
                    <Container py="lg" size="lg">
                        <BreadcrumbSection breadcrumbValues={breadcrumbValues}/>
                        <Title order={3} fw={800} mt="xl">
                            Not found
                        </Title>
                    </Container>
                </Box>  
                <Container size="lg" mt="xl">
                    <Text fz="lg" mt="xl">No taxa found for <Code fz="lg">{queryString}</Code></Text>
                </Container>
            </>
        );
    } 

    return (
    <>  { Object.keys(result).length > 0 &&
            <>
                <Box className={classes.speciesHeader}>
                <Container py={{ base: 'sm', lg: 'xl'}} size="lg">
                    <BreadcrumbSection breadcrumbValues={breadcrumbValues} />
                    <Grid mt={{ base: 'xs', lg: 'md'}} mb="lg">
                        <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                            <Title order={2} fw={600} fs={fontStyle(result.rankID)} mt={{ base: 0, lg: 'md'}} mb={{ base: 4, lg: 'xs'}}>
                                {result.name}
                            </Title>
                            {/* <Badge color="gray" radius="sm" mt={6} mb={6} pt={3}>{combinedResult.rank}</Badge> */}
                            <List 
                                center
                                size="xs"
                                mb={{ base: 'xs', lg: 'md'}}
                                classNames={{ itemIcon: classes.rankName }}
                                >   
                                <List.Item 
                                    fz={14} 
                                    icon={ <IconCircleFilled size={10} color="gray"/> } 
                                >{capitalizeFirstLetter(result.rank)}</List.Item>
                            </List>
                            { result.commonName && result.commonName.map((name: string, idx: number) =>
                                idx < 3 && 
                                    <Text key={idx} size="lg" mt={{ base: 0, lg: 6}}>{name}</Text>
                            )}
                            <Anchor fz="sm" onClick={() => setTab('names')} underline="always">See names</Anchor>
                            {/* <Text mt={8}>{combinedResult.nameComplete}</Text> */}
                            <Text mt="sm">{result.shortDesription || `The ${result.commonName && result.commonName[0] || result.name} is... Create or extract a short species description for use on hero section of species pages.`}</Text>
                            { result && result.invasiveStatuses &&
                                <Alert  icon={<IconFlagFilled />} mt="md" pt={5} pb={5} mr="md"> 
                                    This species is <Anchor inherit fw={600}
                                    onClick={() => setTab('status')}>considered invasive</Anchor> in
                                    some part of Australia and may be of biosecurity concern.
                                </Alert>
                            }
                            
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
                            { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx}  src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image" />
                            )}
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 2, lg: 2 }} className={classes.hideMobile}>
                            <Flex gap={12} direction={{ base: 'row', lg: 'column' }}>
                                { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx} src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image" />
                            )}
                            { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx} src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image"  />
                            )}
                            </Flex>
                        </Grid.Col>
                    </Grid>
                </Container>
            </Box> 
            <Box>
                <Tabs
                    id="occurrence-tabs"
                    value={tab}
                    onChange={handleTabChange} >
                    <Container size="lg">
                        <Tabs.List>
                            <Tabs.Tab value="map">Occurrence map</Tabs.Tab>
                            <Tabs.Tab value="classification">Classification</Tabs.Tab>
                            <Tabs.Tab value="description">Description</Tabs.Tab>
                            <Tabs.Tab value="media">Images and sounds</Tabs.Tab>
                            <Tabs.Tab value="names">Names</Tabs.Tab>
                            <Tabs.Tab value="status">Status</Tabs.Tab>
                            <Tabs.Tab value="traits">Traits</Tabs.Tab>
                            <Tabs.Tab value="datasets">Datasets</Tabs.Tab>
                            <Tabs.Tab value="resources">Resources</Tabs.Tab>
                        </Tabs.List>  
                    </Container>
                    <Divider mt={-1} />  
                </Tabs>
            </Box>
            <Container size="lg">
                <Space h="xl" />
                {tab === 'map' && 
                    <MapView result={result} tab={tab}/>
                }
                {tab === 'classification' && 
                    <ClassificationView result={result}/>
                }
                {tab === 'description' && 
                    <DescriptionView result={result}/>
                }
                {tab === 'media' && 
                    <ImagesView result={result}/>
                }
                {tab === 'names' && 
                    <NamesView result={result} />
                }
                {tab === 'status' && 
                    <StatusView result={result} />
                }
                {tab === 'traits' && 
                    <TraitsView result={result} />
                }
                {tab === 'datasets' && 
                    <DatasetsView result={result} />
                }
                {tab === 'resources' && 
                    <ResourcesView result={result} />
                }
                <Space h="xl" />
            </Container>
            <div className="speciesFooter speciesPage">
                <div className="speciesFooterLine"></div>
                <div className="bi bi-arrow-up-circle-fill float-end speciesFooterUp"
                    onClick={() => window.scrollTo(0, 0)}></div>
            </div>
            </> 
        }
    </>
    );  
}

export default Species;
