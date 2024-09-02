import {
    MapContainer,
    TileLayer
} from 'react-leaflet';
import {FullscreenControl} from "react-leaflet-fullscreen";
import "react-leaflet-fullscreen/styles.css";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useEffect, useRef, useState} from "react";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Radio, Text, Title } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconArrowRight, IconFlagFilled, IconInfoCircleFilled, IconReload } from '@tabler/icons-react';
import '../../css/search.css';

const center = new LatLng(-22, 131)

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
            autoContrast
            radius="sm"
            style={{
                height: "100%",
                textAlign: "left",
                lineHeight: "1.3",
                paddingTop: "15px",
                paddingBottom: "14px",
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
            <div className="speciesMap">
                <MapContainer ref={mapRef} center={center} zoom={4} scrollWheelZoom={false} worldCopyJump={true}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                    />
                    <FullscreenControl position={"topleft"}/>
                </MapContainer>
            </div>
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
                    <Box>
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
        <Divider mt="lg" mb="lg" />
        <Flex justify="flex-start" align="center" gap="xs">
            <IconInfoCircleFilled />
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
        {/* <div className="d-flex">
            <div className="speciesMap">
                <MapContainer ref={mapRef} center={center} zoom={4} scrollWheelZoom={false} worldCopyJump={true}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                    />
                    <FullscreenControl position={"topleft"}/>
                </MapContainer>
            </div>
            <div className="speciesMapControl">
                <div className="speciesRefineView"><span className="bi bi-sliders"></span>Refine view</div>

                <div className="speciesMapControlItem form-check speciesMapControlItemHr">
                    <input className="form-check-input" type="checkbox" value="" id="occurrenceSightings"/>
                    <label className="form-check-label" htmlFor="occurrenceSightings">
                        Occurrence sightings
                    </label>
                </div>

                <div className="speciesMapControlItem speciesMapControlItemHr d-none" >
                    <div className="speciesMapControlDist">Expert distribution maps</div>
                    {distributions && distributions.map((dist, idx) =>
                        <div key={idx} className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="checkbox" value="" id={"dist" + idx}/>
                            <label className="form-check-label" htmlFor={"dist" + idx}>
                                {dist.areaName}
                            </label>
                            <div className="speciesMapControlDistItemTxt">
                                provided by&nbsp;
                                <div className="speciesLink">{dist.dataResourceName}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="speciesMapControlItem">
                    <div className="speciesMapControlDist">Map type</div>
                    <div className="form-check speciesMapControlLayerItem">
                        <input className="form-check-input" type="checkbox" value="" id="mapTypeDefault"/>
                        <label className="form-check-label" htmlFor="mapTypeDefault">
                            Default
                        </label>
                    </div>
                    <div className="form-check speciesMapControlLayerItem">
                        <input className="form-check-input" type="checkbox" value="" id="mapTypeTerrain"/>
                        <label className="form-check-label" htmlFor="mapTypeTerrain">
                            Terrain
                        </label>
                    </div>
                </div>

                <div className="speciesMapControlRefresh">
                    Refresh <span className="bi bi-arrow-clockwise"></span>
                </div>

            </div>
        </div> */}
        {/* <div className="speciesMapAbout">
            <span className="bi bi-info-circle-fill"></span>
            About this map
        </div>
        <div className="speciesMapText">
            Occurrence records show where a species has been recorded, and may not show the full extent of its known
            distribution. Records may contain some error. Expert distributions show species distributions modelled by
            experts or the coarse known distributions of species.
        </div>
        <div className="speciesMapGetStarted">
            Get started
        </div>
        <div className="speciesMapButtons d-flex justify-content-between">
            <div className="speciesMapButton d-flex">
                <div style={{marginRight: "30px"}}>Explore and download occurrence records</div>
                <div className="bi bi-arrow-right-short ms-auto species-red"></div>
            </div>
            <div className="speciesMapButton d-flex">
                <div style={{marginRight: "30px"}}>Advanced mapping</div>
                <div className="bi bi-arrow-right-short ms-auto species-red"></div>
            </div>
            <div className="speciesMapButton d-flex">
                <div style={{marginRight: "30px"}}>How to submit observations</div>
                <div className="bi bi-arrow-right-short ms-auto species-red"></div>
            </div>
            <div className="speciesMapButton d-flex">
                <div style={{marginRight: "30px"}}>Receive alerts for new records</div>
                <div className="bi bi-arrow-right-short ms-auto species-red"></div>
            </div>
        </div> */}
    </>
}

export default MapView;
