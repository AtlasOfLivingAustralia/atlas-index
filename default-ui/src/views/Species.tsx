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
import { Alert, Anchor, Badge, Box, Code, Container, Divider, Flex, Grid, Image, Space, Tabs, Text, Title } from "@mantine/core";
import classes from '../App.module.css';
import { IconFlagFilled } from "@tabler/icons-react";
import BreadcrumbSection from "../components/header/breadcrumbs.tsx";
// import Breadcrumbs from "../components/breadcrumbs/breadcrumbs.tsx";

function Species({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string
}) {
    const [tab, setTab] = useState('map');
    const [result, setResult] = useState<Record<PropertyKey, string | number | any >>({});
    const [resultV1, setResultV1] = useState<Record<PropertyKey, string | number | any>>({});

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
                setResult(data[0])
            }
        })
        .catch(error => {
            console.warn(error);
            // setResult({});
        })

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
            data && setResultV1(data);
        })
        .catch(error => {
            console.warn(error);
            // setResultV1({});
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

    if (!result || Object.keys(result).length === 0) {
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
                <Container size="lg">
                    <Text fz="lg" mt="xl">No taxa found for <Code fz="lg">{queryString}</Code></Text>
                </Container>
            </>
        );
    } 

    return (
        <>
            <Box className={classes.speciesHeader}>
                <Container py="lg" size="lg">
                    <BreadcrumbSection breadcrumbValues={breadcrumbValues}/>
                    <Grid mt="md" mb="lg">
                        <Grid.Col span={6}>
                            <Title order={3} fw={600} fs={fontStyle(result.rankID)}>
                                {result.name}
                            </Title>
                            <Badge color="gray" radius="sm" mt={6} mb={6} pt={3}>{result.rank}</Badge>
                            {result.commonName && result.commonName.map((name: string, idx: number) =>
                                idx < 3 && 
                                    <Text key={idx} size="lg" mt={6}>{name}</Text>
                                
                            )}
                            <Anchor fs="sm" onClick={() => setTab('names')} underline="always">See names</Anchor>
                            <Text mt={8}>{result.nameComplete}</Text>
                            { result && result.invasiveStatuses &&
                                <Alert  icon={<IconFlagFilled />} mt="md" pt={5} pb={5} mr="md"> 
                                    This species is <Anchor inherit fw={600}
                                    onClick={() => setTab('status')}>considered invasive</Anchor> in
                                    some part of Australia and may be of biosecurity concern.
                                </Alert>
                            }
                            
                        </Grid.Col>
                        <Grid.Col span={4}>
                            {result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx}  src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image" />
                            )}
                        </Grid.Col>
                        <Grid.Col span={2}>
                            {result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx} src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image" />
                            )}
                            {result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && 
                                    <Image key={idx} mt="sm" src={"https://images.ala.org.au/image/proxyImageThumbnail?imageId=" + id} alt="species image" />
                            )}
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
                    <NamesView result={result} resultV1={resultV1}/>
                }
                {tab === 'status' && 
                    <StatusView result={result} resultV1={resultV1}/>
                }
                {tab === 'traits' && 
                    <TraitsView result={result} resultV1={resultV1}/>
                }
                {tab === 'datasets' && 
                    <DatasetsView result={result} resultV1={resultV1}/>
                }
                {tab === 'resources' && 
                    <ResourcesView result={result} resultV1={resultV1}/>
                }
                <Space h="xl" />
            </Container>
            <div className="speciesFooter speciesPage">
                <div className="speciesFooterLine"></div>
                <div className="bi bi-arrow-up-circle-fill float-end speciesFooterUp"
                    onClick={() => window.scrollTo(0, 0)}></div>
            </div>
        </>
    );
}

export default Species;
