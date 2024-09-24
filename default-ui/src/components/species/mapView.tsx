import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet';
import { LatLng, map} from "leaflet";
import { FullscreenControl } from "react-leaflet-fullscreen";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Image, Overlay, Popover, Radio, Switch, Text, Title } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconFlagFilled, IconInfoCircleFilled, IconReload } from '@tabler/icons-react';
import LargeLinkButton from "../common/externalLinkButton";

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-fullscreen/styles.css';
import classes from "./species.module.css";

const center = new LatLng(-27, 133);
// const mapType: 'static' | 'leaflet' = "leaflet";
interface MapViewProps {
    queryString?: string;
    tab?: string;
    result?: Record<PropertyKey, string | number | any >;
}

interface OnlineResource {
    name: string | JSX.Element;
    url: string;
};

interface Distribution {
    geomIdx: string;
    dataResourceUid: string;
    areaName: string;
    dataResourceName: string;
    url?: string;
    checked?: boolean;
}

function MapView({queryString, tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [showOccurrences, setShowOccurrences] = useState<string>('');
    const [baseLayers, setBaseLayers] = useState('default');
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [opened, setOpened] = useState(false);
    const [mapType, setMapType] = useState<'static' | 'leaflet'>('leaflet');
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
            setShowOccurrences(result?.guid); // Workaround to update records layer when taxon changes

            // fetch("https://spatial.ala.org.au/ws/distribution/lsids/" + result.guid + "?nowkt=true").then(response => response.json()).then(data => {
            //     setDistributions(data)
            // })
            if (result.distributions) {
                // setDistributions(JSON.parse(result.distributions))
                generateDistributionMapObj(result?.distributions)
            }
        }
    }, [result]);

    function formatNumber(occurrenceCount: any) {
        return occurrenceCount.toLocaleString();
    }
    
    function createAlertForTaxon(guid: string | undefined) {
        // TODO: Implement alert creation
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

    function getAlaWmsUrl(guid: string) {
        // TODO: Fix hex binning to be dynamic, based on range of records for the species
        // TODO: Add a legend for the hex binning colours
        // const wmsParams = `&FORMAT=image/png&TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&SRS=EPSG:900913&WIDTH=256&HEIGHT=256`;
        const wmsUrl = `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=lsid:${guid}&OUTLINE=false&OUTLINECOLOUR=0xFFFFFF&ENV=size:3;colormode:hexbin;color:4Cffc557,3,72fcad54,30,99f99650,300,BFf57e4d,3000,FFf26649`;
        return wmsUrl;
    }

    function generateStaticMapImageUrl() {
        // TODO: create a static map using hex bins OR delete if going with dynamic map
        const otherParams = "&forceRefresh=false&forcePointsDisplay=false&pointColour=0000ff&pointHeatMapThreshold=500&opacity=1"
        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/static?q=lsid%3A${result?.guid}${otherParams}`;
    };

    function generateDistributionMapObj(distributions: Distribution[] | string | null) {
        let spatialObjects: Distribution[] = [];

        // Utility function to add 'url' and 'checked' attrs to distribution object (state management)
        const augmentDistroData = (distros: Distribution[]) : Distribution[] => {
            distros.forEach((distro) => {
                distro.url = `${import.meta.env.VITE_SPATIAL_URL}/ws/distribution/map/png/${distro.geomIdx}`;
                distro.checked = false;
            });

            return distros;
        }

        if (distributions && typeof distributions === 'string') {
            // Hack to handle escaped JSON inside a JSON value
            const distributions2 = JSON.parse(distributions.replace(/\\"/g, '"'));
            spatialObjects = augmentDistroData(distributions2 || []);
        } else if (distributions && Array.isArray(distributions)) {
            // Assume it's already parsed
            spatialObjects = augmentDistroData(distributions);
        } else {
            console.error("generateDistributionMap: Invalid distribution data", distributions);
        }

        setDistributions(spatialObjects);
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
        <Flex gap="xl" align="center" direction="row">
            <Title order={4} fw={800} mt="lg" mb="lg" miw={{base: "", sm: "480px", md: "696px", lg: "884px"}}>
                {occurrenceCount >= 0 && <>
                    {formatNumber(occurrenceCount)}
                    <Text fw={500} inherit span> occurrence records</Text>
                </>}
            </Title>
            <Switch
                // display="none"
                size="md"
                onLabel="D" 
                offLabel="S" 
                label={<Text c="grey" fs="lg" pt={1}>Demo mode</Text>}
                checked={mapType === 'leaflet'}
                onChange={(event) => setMapType(event.currentTarget.checked ? 'leaflet' : 'static')}
            />
        </Flex>
        <Flex gap={{ base: "sm", md: "md", lg: "lg" }} mt="md">
            <Box style={{
                height: "100%",
                width: "100%",
                borderRadius: "10px",
            }}>
                <Popover 
                    width="auto"
                    withArrow 
                    arrowSize={10}
                    offset={-120}
                    shadow="md"
                    middlewares={{ flip: false, shift: false }}
                    opened={opened} 
                    onChange={setOpened}
                    floatingStrategy="fixed"
                    position="bottom" // {{ base: 'bottom', lg: 'right'}}
                >
                    <Popover.Target>
                        <span style={{ display: 'block', cursor: 'pointer' }} onClick={() => setOpened((o) => !o)}>
                            { mapType === 'leaflet' && 
                                <Box pos="relative">
                                    <MapContainer 
                                        ref={mapRef} 
                                        center={center} 
                                        zoom={4} 
                                        // zoomControl={false}
                                        // scrollWheelZoom={false} 
                                        worldCopyJump={true} 
                                        style={{height: "530px", borderRadius: "10px"}}
                                    >
                                        { baseLayers === 'default' && 
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                                                zIndex={1}
                                            />
                                        }
                                        { baseLayers === 'terrain' && 
                                            <TileLayer
                                                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                                                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                                zIndex={1}
                                            />
                                        }
                                        { showOccurrences && 
                                            <WMSTileLayer
                                                url={getAlaWmsUrl(showOccurrences)}
                                                layers="ALA:occurrences"
                                                format="image/png"
                                                transparent={true}
                                                attribution="Atlas of Living Australia"
                                                zIndex={15}
                                            />
                                        }
                                        { distributions && distributions.map((dist, idx) => 
                                            dist.checked && <WMSTileLayer
                                                key={idx}
                                                url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon&viewparams=s:${dist.geomIdx}&`}
                                                layers="ALA:Distributions"
                                                format="image/png"
                                                styles="polygon"
                                                transparent={true}
                                                opacity={0.6}
                                                attribution={dist.dataResourceName}
                                                zIndex={10}
                                            />
                                        )}  
                                        <FullscreenControl position={"topleft"}/>
                                    </MapContainer>
                                    {/* <Overlay color="#000" backgroundOpacity={0} blur={0} /> */}
                                </Box>
                            }
                            { mapType === 'static' && 
                                <Flex align="center" justify="center" w="100%" py={38}>
                                    <Image src={generateStaticMapImageUrl()} alt={`Record density map`} maw="512px" />
                                </Flex>
                            }
                        </span>
                    </Popover.Target>
                    <Popover.Dropdown style={{ textAlign: 'center' }} maw="95%">
                        <Button variant="filled" fullWidth
                            onClick={() => { 
                                window.open(`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:${result?.guid}#mapView`, '_map') 
                            }}
                            size="md">
                            View an interactive version of this map
                        </Button>
                        <Text mt="sm" fz="sm">Opens the ALA occurrence data explorer in a new window</Text>
                    </Popover.Dropdown>
                </Popover>
                <Flex justify="flex-start" align="center" gap="xs" mt="xl">
                    <IconInfoCircleFilled size={24}/>
                    <Text fw={800} fz={16}>About this map</Text>
                </Flex>
                <Text mt="sm" mb="lg">
                    Occurrence records show where a species has been recorded, and may not show the full extent of its known
                    distribution. Records may contain some error. Expert distributions show species distributions modelled by
                    experts or the coarse known distributions of species.
                </Text>
                { mapType === 'static' && distributions && distributions.map((dist, idx) =>
                    <Box key={idx}>
                        <Divider mt="lg" mb="lg" />
                        <Text fw="bold" fz="lg" mt="sm">{dist.areaName || 'Expert distribution '} provided 
                            by <Anchor inherit href={`${import.meta.env.VITE_COLLECTIONS_URL}/public/show/${dist.dataResourceUid}`}
                            target="_blank">{dist.dataResourceName}</Anchor></Text>
                        <Image src={dist.url} alt={`Expert distribution map`}  w="512px"/>
                    </Box>
                )}
                
            </Box>
            <Box pos="relative" pl={5} className={classes.hideMobile}>
                <Flex justify="flex-start" align="center" gap="sm">
                    <IconAdjustmentsHorizontal />
                    <Text fw="bold">Refine view</Text>
                </Flex>
                <Divider mt="lg" mb="lg" />
                <Checkbox checked={showOccurrences.length > 0} size="xs" 
                    onChange={() => {setShowOccurrences(showOccurrences.length > 0 ? '' : result?.guid)}} 
                    label="Species records" />
                <Divider mt="lg" mb="lg" />
                <Text fw="bold" mb="sm">Expert distribution maps</Text>
                { distributions && distributions.map((dist, idx) =>
                    <Box key={idx}>
                        <Checkbox 
                            checked={dist.checked} 
                            onChange={() => { 
                                const updatedDistributions = distributions.map((d, i) => 
                                    i === idx ? { ...d, checked: !d.checked } : d
                                );
                                setDistributions(updatedDistributions);
                            }} 
                            size="xs" 
                            id={"dist" + idx}
                            label={
                                <>{dist.areaName}<Text fs='normal' fz='sm' mt={4}>provided by{' '}
                                    <Anchor inherit href="#">{dist.dataResourceName}</Anchor></Text>
                                </>
                            } 
                        />
                    </Box>
                )}
                { distributions && distributions.length === 0 &&
                    <Text size="sm" c="grey">No expert distribution maps available</Text>
                }
                <Divider mt="lg" mb="lg" />
                <Text fw="bold" mb="md">Map type</Text>
                <Radio.Group 
                    value={baseLayers}
                    onChange={setBaseLayers}
                > 
                    <Radio size="xs" value="default"
                        label="Default" />
                    <Radio size="xs"  value="terrain"
                        label="Terrain" />
                </Radio.Group>
                <Button 
                    mt="lg" 
                    display='none' // TODO: Remove this line if not using as "reset map" button
                    variant="default" 
                    radius="xl"
                    fullWidth
                    rightSection={<IconReload />}
                    onClick={() => { 
                        alert('Bang, goes the totally redundant button');
                    }}
                >Refresh</Button>
                { mapType === 'static' && 
                    <Overlay color="#000" backgroundOpacity={0} blur={2} />
                }
            </Box>
        </Flex>
        <Title order={4} fw={800} mt="xl" mb="lg">
            Get started
        </Title>
        <Grid mt="lg" gutter={{base: 15, md: 20, lg: 35}}>
            {onlineResources.map((resource: OnlineResource, idx) => (
                <Grid.Col span={{ base: 12, md: 6, lg: 3 }} key={idx}>
                    <LargeLinkButton url={resource.url}>{resource.name}</LargeLinkButton>
                </Grid.Col>
            ))}
        </Grid>
    </>
}

export default MapView;
