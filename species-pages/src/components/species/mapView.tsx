import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';
import { LatLng } from "leaflet";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Radio, Text, Title } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconFlagFilled, IconInfoCircleFilled, IconReload } from '@tabler/icons-react';
import LargeLinkButton from "../common/externalLinkButton";

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-fullscreen/styles.css';
import classes from "./species.module.css";
import Legend from "./mapLegend";
import Control from "react-leaflet-custom-control";
import FormatName from "../nameUtils/formatName";

const center = new LatLng(-28, 133);
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

/**
 * Child component of the Leaflet Map that listens to map events
 * 
 * @param setMapStateChanged useState setter 
 * @returns 
 */
function MapStateUtil({setMapStateChanged}: {setMapStateChanged: (state: boolean) => void}) {
    const map = useMap()
    const onChange = useCallback(() => {
        setMapStateChanged(true);
    }, [map])
    
    // Listen to events on the map
    const handlers = useMemo(() => ({ mouseup: onChange }), [])
    useMapEvents(handlers) // register listener (can only be called in a child of MapContainer)

    return <></>
}

function MapView({tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [showOccurrences, setShowOccurrences] = useState<string>('');
    const [baseLayers, setBaseLayers] = useState('default');
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [hexValuesScaled, setHexValuesScaled] = useState(false);
    const [mapStateChanged, setMapStateChanged] = useState(false);
    const mapRef = useRef<L.Map | null>(null);
    const [hexBinValues, setHexBinValues] = useState<[string, number | null][]>([
        ["FFC577", 1],
        ["E28946", 10],
        ["D36B3D", 100],
        ["C44D34", 1000],
        ["802937", null]
    ]); // Note the count values are scaled by a factor below 
    const recordLayerOpacity = 0.7
    const defaultZoom = 4;

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
            setOccurrenceCount(result?.occurrenceCount)
            setShowOccurrences(result?.guid); // Workaround to update records layer when taxon changes

            if (result.distributions) {
                generateDistributionMapObj(result?.distributions)
            }
        }
    }, [result]);

    // Scale the hex bin values based on the number of records
    useEffect(() => {
        if (hexValuesScaled || !occurrenceCount || occurrenceCount < 1) {
            return;
        }
        let binFactor = 20; // default for over 500k records
        if (occurrenceCount < 25000) {
            binFactor = 1;
        } else if (occurrenceCount < 50000) {
            binFactor = 2;
        } else if (occurrenceCount < 200000) {
            binFactor = 5;
        } else if (occurrenceCount < 500000) {
            binFactor = 10;
        } 
        const hexBinValuesScaled: [string, number | null][] = hexBinValues.map(([hex, count]) => [
            hex,
            typeof count === 'number' ? (count * binFactor) : null, // tried using (binFactor * binFactor) but reverted it
        ])
        // console.log("scaleHexBinValues", occurrenceCount, binFactor, hexBinValues, hexBinValuesScaled);
        setHexBinValues(hexBinValuesScaled);
        setHexValuesScaled(true); // keep track of scaling "state"
    }, [occurrenceCount]);

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
            url: `${import.meta.env.VITE_SPATIAL_URL}?q=lsid:${result?.guid}`
        },
        {
            name: <>How to submit <br/>observations</>,
            url: `${import.meta.env.VITE_HOME_URL}/home/record-a-sighting/`
        },
        {
            name: <>Receive alerts for <br/>new records</>,
            url: createAlertForTaxon(result?.guid)
        }
    ];    
    
    const mapStateIsDefault = useMemo(() => {        
        if (baseLayers !== 'default') {
            return false;
        }

        if (showOccurrences === '') {
            return false;
        }

        if (distributions && distributions.some(dist => dist.checked)) {
            return false;
        }

        if (mapStateChanged) {
            return false;
        }

        return true;
    }, [baseLayers, showOccurrences, distributions, mapStateChanged]);

    function getAlaWmsUrl(guid: string) {
        const hexBinParam = hexBinValues.join(',').replace(/,$/, '');
        const wmsUrl = `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=lsid:${guid}&OUTLINE=false&ENV=size:3;colormode:hexbin;color:${hexBinParam}`;
        return wmsUrl;
    }

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

    // Reset map to default state
    const resetMap = () => {
        mapRef.current?.setView(center, defaultZoom);
        setBaseLayers('default');
        setMapStateChanged(false);
        setDistributions(distributions.map((dist) => ({ ...dist, checked: false })));
        setShowOccurrences(result?.guid);
    }

    if (!result) {
        return <></>
    }

    return <>
        { result.sdsStatus &&
            <Alert icon={<IconFlagFilled />} style={{ display: 'inline-block' }} mb="xl" pt={7} pb={6} pr="lg">
                This species is <Text fw={600} inherit span>considered sensitive</Text> in at least one jurisdiction. 
                Some or all occurrence data has been
                obfuscated. <Anchor inherit href={import.meta.env.VITE_SDS_INFO_URL}>More info</Anchor>.
            </Alert>
        }
        <Flex gap="xl" align="center" direction="row">
            <Title order={4} fw={800} mt={0} mb="lg" miw={{base: "", sm: "480px", md: "696px", lg: "884px"}}>
                {occurrenceCount >= 0 && <>
                    {formatNumber(occurrenceCount)}
                    <Text fw={500} inherit span> occurrence records</Text>
                </>}
            </Title>
        </Flex>
        <Flex gap={{ base: "sm", md: "md", lg: "lg" }} mt="md">
            <Box style={{
                height: "100%",
                width: "100%",
                borderRadius: "10px",
            }}>
                <Box pos="relative">
                    <MapContainer
                        ref={mapRef}
                        center={center}
                        zoom={defaultZoom}
                        scrollWheelZoom={false}
                        worldCopyJump={true}
                        style={{height: "530px", borderRadius: "10px"}}
                    >
                        <MapStateUtil setMapStateChanged={setMapStateChanged} />
                        { baseLayers === 'default' &&
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url={`${import.meta.env.VITE_SPATIAL_URL}/osm/{z}/{x}/{y}.png`}
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
                        { showOccurrences && hexValuesScaled &&
                            <WMSTileLayer
                                url={getAlaWmsUrl(showOccurrences)}
                                layers="ALA:occurrences"
                                format="image/png"
                                transparent={true}
                                opacity={recordLayerOpacity}
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
                        <Control prepend position='bottomleft'>
                            { showOccurrences && hexValuesScaled &&
                                <Legend fillOpacity={recordLayerOpacity} hexBinValues={hexBinValues} />
                            }
                        </Control>
                    </MapContainer>
                </Box>
                <Flex justify="flex-start" align="center" gap="5px" mt="xl">
                    <IconInfoCircleFilled size={24}/>
                    <Text fw={800} fz={16}>About this map</Text>
                </Flex>
                <Text mt="sm" mb="lg">
                    Occurrence records show where a species has been recorded, and may not show the full extent of its known
                    distribution. Records may contain some error. Expert distributions show species distributions modelled by
                    experts or the coarse known distributions of species.
                </Text>
            </Box>
            <Box pos="relative" pl={5} className={classes.hideMobile}>
                <Flex justify="flex-start" align="center" gap="sm">
                    <IconAdjustmentsHorizontal />
                    <Text fw="bold">Refine view</Text>
                </Flex>
                <Divider mt="lg" mb="lg" />
                <Checkbox checked={showOccurrences.length > 0} size="xs"
                    onChange={() => {setShowOccurrences(showOccurrences.length > 0 ? '' : result?.guid)}}
                    label="Occurrence records" />
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
                                    <Anchor inherit href={dist.dataResourceUid ? `${import.meta.env.VITE_COLLECTIONS_URL}/public/show/${dist.dataResourceUid}` : '#'} target="_blank">{dist.dataResourceName}</Anchor></Text>
                                </>
                            }
                        />
                    </Box>
                )}
                { distributions && distributions.length === 0 &&
                    <Text size="sm" c="grey">No expert distribution maps available for <FormatName name={result?.name} rankId={result?.rankID} /></Text>
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
                    variant="default"
                    radius="xl"
                    fullWidth
                    rightSection={<IconReload />}
                    disabled={mapStateIsDefault}
                    onClick={resetMap}
                >Reset Map</Button>
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
