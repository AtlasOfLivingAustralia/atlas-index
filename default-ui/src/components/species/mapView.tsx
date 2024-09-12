import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from 'react-leaflet';
import { LatLng} from "leaflet";
import { FullscreenControl } from "react-leaflet-fullscreen";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Overlay, Popover, Radio, Text, Title } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconFlagFilled, IconInfoCircleFilled, IconReload } from '@tabler/icons-react';
import LargeLinkButton from "../common/externalLinkButton";

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-fullscreen/styles.css';

const center = new LatLng(-27, 133);

interface MapViewProps {
    queryString?: string,
    tab?: string,
    result?: Record<PropertyKey, string | number | any >
}

interface OnlineResource {
    name: string | JSX.Element;
    url: string;
};

function MapView({queryString, tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [distributions, setDistributions] = useState<any[]>([]);
    const [showOccurrences, setShowOccurrences] = useState(true);
    const [mapControls, setMapControls] = useState('default');
    const [opened, setOpened] = useState(false);
    const mapRef = useRef(null);

    useEffect(() => {
        if (tab === 'map') {
            setTimeout(() => {
                // @ts-ignore
                mapRef.current?.invalidateSize(false);
            }, 300); // Adjust timeout to tab transition
        }
    }, [tab]);

    useEffect(() => {
        if (result?.guid) {
            // fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?q=lsid:"' + encodeURIComponent(result.guid) + '"&pageSize=0&facet=false')
            //     .then(response => response.json())
            //     .then(data => setOccurrenceCount(data.totalRecords));
            setOccurrenceCount(result?.occurrenceCount)

            // fetch("https://spatial.ala.org.au/ws/distribution/lsids/" + result.guid + "?nowkt=true").then(response => response.json()).then(data => {
            //     setDistributions(data)
            // })
            if (result.distributions) {
                setDistributions(JSON.parse(result.distributions))
            }
        }
    }, [result]);

    function formatNumber(occurrenceCount: any) {
        return occurrenceCount.toLocaleString();
    }
    
    const createAlertForTaxon = (guid: string | undefined) => {
        // Create alert for taxon
        return `javascript:alert('TODO: Create alert for taxon ${guid}')`;
    };
    
    const onlineResources: OnlineResource[] = [
        {
            name: <>Explore and download <br/>occurrence records</>,
            url: `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:${result?.guid}`
        },
        {
            name: "Advanced mapping",
            url: `https://spatial.ala.org.au?q=lsid:${result?.guid}`
        },
        {
            name: <>How to submit <br/>observations</>,
            url: "https://www.ala.org.au/home/record-a-sighting/"
        },
        {
            name: <>Receive alerts for <br/>new records</>,
            url: createAlertForTaxon(result?.guid)
        }
    ];

    const generateImageUrl = () => {
        // Generate the URL string here
        // https://api.ala.org.au/occurrences/occurrences/static?q=lsid%3Ahttps%3A%2F%2Fbiodiversity.org.au%2Fafd%2Ftaxa%2F2a4e373b-913a-4e2a-a53f-74828f6dae7e&forceRefresh=false&forcePointsDisplay=false&pointColour=0000ff&pointHeatMapThreshold=500&opacity=1
        return `https://api.ala.org.au/occurrences/occurrences/static?q=lsid%3A${result?.guid}&forceRefresh=false&forcePointsDisplay=false&pointColour=0000ff&pointHeatMapThreshold=500&opacity=1`;
    };

    if (!result) {
        return <></>
    }

    return <>
        { result.conservationStatuses &&
            <Alert icon={<IconFlagFilled />} style={{ display: 'inline-block' }} mt="lg" pt={7} pb={6} pr="lg"> 
                This species is <Text fw={600} inherit span>considered sensitive</Text> in at least one jurisdiction. Some or all occurrence data has been
                obfuscated. <Anchor inherit href="#">More info</Anchor>.
            </Alert>
        }
        <Title order={4} fw={800} mt="lg" mb="lg">
            {occurrenceCount >= 0 && <>
                {formatNumber(occurrenceCount)}
                <Text fw={500} inherit span> occurrence records</Text>
            </>}
        </Title>
        <Flex gap="lg" mt={6}>
            <Box style={{
                height: "100%",
                width: "100%",
                borderRadius: "10px",
            }}>
                {/* <MapContainer 
                    ref={mapRef} 
                    center={center} 
                    zoom={4} 
                    scrollWheelZoom={false} 
                    worldCopyJump={true} 
                    style={{height: "530px", borderRadius: "10px"}}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                    />
                    <FullscreenControl position={"topleft"}/>
                </MapContainer> */}
                <Popover 
                    width="auto"
                    withArrow 
                    shadow="md"
                    opened={opened} onChange={setOpened}
                    position="right"
                >
                    <Popover.Target>
                        <span style={{ display: 'inline-block', cursor: 'pointer' }} onClick={() => setOpened((o) => !o)}>
                            <img src={generateImageUrl()} alt={`Record density map`} />
                        </span>
                    </Popover.Target>
                    <Popover.Dropdown style={{ textAlign: 'center' }}>
                        <Button variant="filled" fullWidth
                            onClick={() => { 
                                window.open(`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:${result?.guid}#mapView`, '_map') 
                            }}
                            size="md">
                            View an interactive version of this map
                        </Button>
                        <Text mt="sm" fz="sm">Opens the ALA occurrence data explorer in a new window</Text>
                        {/* <Button variant="outline" mt="sm" onClick={() => setOpened((o) => !o)}>Close</Button> */}
                    </Popover.Dropdown>
                </Popover>
                
            </Box>
            <Box pos="relative" pl={5}>
                <Flex justify="flex-start" align="center" gap="sm">
                    <IconAdjustmentsHorizontal />
                    <Text fw="bold">Refine view</Text>
                </Flex>
                <Divider mt="lg" mb="lg" />
                <Checkbox checked={showOccurrences} size="xs" 
                    onChange={() => {setShowOccurrences(!showOccurrences)}} 
                    label="Species records" />
                <Divider mt="lg" mb="lg" />
                <Text fw="bold" mb="md">Expert distribution maps</Text>
                { distributions && distributions.map((dist, idx) =>
                    <Box key={idx}>
                        <Checkbox checked={dist.checked} size="xs" 
                            id={"dist" + idx}
                            label={dist.areaName} />
                        <Text fz="sm" ml="xl">
                            provided by&nbsp;
                            <Anchor inherit href="#">{dist.dataResourceName}</Anchor>
                        </Text>
                    </Box>
                )}
                <Divider mt="lg" mb="lg" />
                <Text fw="bold" mb="md">Map type</Text>
                <Radio.Group 
                    value={mapControls}
                    onChange={setMapControls}
                > 
                    <Radio size="xs" value="default"
                        label="Default" />
                    <Radio size="xs"  value="terrain"
                        label="Terrain" />
                </Radio.Group>
                <Button 
                    mt="lg" 
                    variant="default" 
                    radius="xl"
                    fullWidth
                    rightSection={<IconReload />}>Refresh</Button>
                <Overlay color="#000" backgroundOpacity={0} blur={2} />
            </Box>
        </Flex>
        <Flex justify="flex-start" align="center" gap="xs" mt="xl">
            <IconInfoCircleFilled size={24}/>
            <Text fw={800} fz={16}>About this map</Text>
        </Flex>
        <Text mt="sm" mb="lg">
            Occurrence records show where a species has been recorded, and may not show the full extent of its known
            distribution. Records may contain some error. Expert distributions show species distributions modelled by
            experts or the coarse known distributions of species.
        </Text>
        <Title order={4} fw={800} mt="xl" mb="lg">
            Get started
        </Title>
        <Grid mt="lg" gutter={35}>
            {onlineResources.map((resource: OnlineResource, idx) => (
                <Grid.Col span={3} key={idx}>
                    <LargeLinkButton url={resource.url}>{resource.name}</LargeLinkButton>
                </Grid.Col>
            ))}
        </Grid>
    </>
}

export default MapView;
