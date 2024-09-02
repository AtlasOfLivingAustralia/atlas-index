import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from 'react-leaflet';
import { LatLng} from "leaflet";
import { FullscreenControl } from "react-leaflet-fullscreen";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Radio, Text, Title } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconArrowRight, IconFlagFilled, IconInfoCircleFilled, IconReload } from '@tabler/icons-react';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-fullscreen/styles.css';

const center = new LatLng(-27, 133);

interface MapViewProps {
    queryString?: string,
    tab?: string,
    result?: Record<PropertyKey, string | number | any >
}

function MapView({queryString, tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [distributions, setDistributions] = useState<any[]>([]);
    const [showOccurrences, setShowOccurrences] = useState(true);
    const [mapControls, setMapControls] = useState('default');
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

    const ExploreButton = (props: any) => {
        return <Button 
            component="span" 
            variant="outline" 
            size="md"
            fullWidth
            style={{
                height: "100%",
                textAlign: "left",
                lineHeight: "1.3",
                paddingTop: "12px",
                paddingBottom: "11px",
            }}
            rightSection={<IconArrowRight />}
        >{props?.children}</Button>
    }

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
                <MapContainer 
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
                </MapContainer>
            </Box>
            <Box>
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
        <Grid>
            <Grid.Col span={3}><ExploreButton>Explore and download <br/>occurrence records</ExploreButton></Grid.Col>
            <Grid.Col span={3}><ExploreButton>Advanced mapping</ExploreButton></Grid.Col>
            <Grid.Col span={3}><ExploreButton>How to submit <br/>observations</ExploreButton></Grid.Col>
            <Grid.Col span={3}><ExploreButton>Receive alerts for <br/>new records</ExploreButton></Grid.Col>
        </Grid>
    </>
}

export default MapView;
