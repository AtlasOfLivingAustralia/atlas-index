import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {
    Accordion, Anchor,
    Box,
    Button,
    Checkbox,
    Container,
    Flex,
    Grid,
    Slider,
    Space,
    Text,
    Title
} from "@mantine/core";
import {MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer, Popup} from 'react-leaflet';
import {
    DotsOneIcon
} from '@atlasoflivingaustralia/ala-mantine';
import {IconInfoCircleFilled, IconReload, IconZoomIn} from "@tabler/icons-react";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useNavigate} from "react-router-dom";

// TODO: move to .env file
const REGION_AGGREGATE = "aggregate";
const center = new LatLng(-28, 133);
const OBJECT_OPACITY = 100;
const LAYER_OPACITY = 60;
const defaultZoom = 4;

interface SelectedLayer {
    layerName: string;
    fid: string;
}

interface SelectedObject {
    pid: string;
    name: string;
    bbox: string;
    description?: string;
    latlng?: [number, number];
}

interface MenuItem {
    label: string;
    layerName: string;
    fid?: string;
    objects?: any[];
    fields?: any[];
}


/**
 * Child component of the Leaflet Map that listens to map events
 *
 * @param setMapStateChanged useState setter
 * @returns
 */
function MapStateUtil({setMapStateChanged}: { setMapStateChanged: (state: boolean) => void }) {
    const map = useMap()
    const onChange = useCallback(() => {
        setMapStateChanged(true);
    }, [map])

    // Listen to events on the map
    const handlers = useMemo(() => ({mouseup: onChange}), [])
    useMapEvents(handlers) // register listener (can only be called in a child of MapContainer)

    return <></>
}

function MapClickHandler({onClick}: { onClick: (latlng: LatLng) => void }) {
    useMapEvents({
        click: (e) => {
            onClick(e.latlng);
        },
    });

    return null;
}

function Regions({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string,
    login?: () => void,
    logout?: () => void
}) {

    const [mapStateChanged, setMapStateChanged] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedLayer, setSelectedLayer] = useState<SelectedLayer | null>(null);
    const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [showLayer, setShowLayer] = useState(true);
    const [showObject, setShowObject] = useState(true);
    const [objectOpacity, setObjectOpacity] = useState(OBJECT_OPACITY);
    const [layerOpacity, setLayerOpacity] = useState(LAYER_OPACITY);

    const navigate = useNavigate();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Species search', href: '/'},
            {title: 'Regions', href: '/regions'}
        ]);

        // TODO: use a fetch to get this from /static
        const url = `${import.meta.env.VITE_REGIONS_CONFIG_URL}/regionsList.json`;
        const regionsConfig = fetch(url).then((response) => response.json());

        regionsConfig.then((json) => {
            // regionsConfig is a list, iterate through items

            const list = [];
            for (const region of json) {
                console.log(region);
                list.push({
                    label: region.name,
                    layerName: region.layerName,
                    fid: region.fid,
                    objects: region.objects,
                    fields: region.fields
                });
            }
            setMenuItems(list);
        })
    }, []);

    const resetMap = () => {
        mapRef.current?.setView(center, defaultZoom);
        setMapStateChanged(false);
        setSelectedLayer(null);
        setSelectedObject(null);
    }

    const handleMapClick = async (latlng: LatLng) => {
        console.log('Map clicked at:', latlng);

        if (mapRef.current && selectedLayer) {
            const url = `${import.meta.env.VITE_SPATIAL_URL}/ws/intersect/${selectedLayer.fid}/${latlng.lat}/${latlng.lng}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data && data.length > 0) {
                const pid = data[0].pid;
                const label = data[0].value;

                // also need the bbox
                const url2 = `${import.meta.env.VITE_SPATIAL_URL}/ws/object/${pid}`;
                const response2 = await fetch(url2);
                const data2 = await response2.json();
                console.log("bbox", data2);
                setMapObject(selectedLayer, {pid: pid, name: label, bbox: data2.bbox, description: data2.description});
            }
            console.log(data);
        }
    };

    function setMapObject(layer: SelectedLayer, obj: SelectedObject | undefined = undefined) {
        setMapStateChanged(true);

        // TODO: this is an ugly hack to force the map to update the selected layer or object, fix it
        if (selectedLayer && selectedLayer.layerName != layer.layerName) {
            setSelectedLayer(null);

            // reset zoom if the layer changes
            mapRef.current?.setView(center, defaultZoom);
        }
        if (selectedObject && obj && selectedObject.pid != obj.pid) {
            setSelectedObject(null);
        } else if (!obj && selectedObject) {
            setSelectedObject(null);
        }
        setTimeout(() => {
            setSelectedLayer({layerName: layer.layerName, fid: layer.fid});
            if (obj) {
                // convert bbox WKT POLYGON to center latlng
                let points = obj.bbox.replace("POLYGON((", "").replace("))", "").split(",");
                obj.latlng = [(parseFloat(points[0].split(" ")[1]) + parseFloat(points[2].split(" ")[1])) / 2, (parseFloat(points[0].split(" ")[0]) + parseFloat(points[2].split(" ")[0])) / 2];
                setSelectedObject(obj);
            }
        }, 5);
    }

    function openObject() {
        if (!selectedObject) {
            return;
        }
        navigate(`/region?id=${selectedObject.pid}`);
    }

    function zoomToObject() {
        if (!selectedObject) {
            return;
        }

        // convert bbox WKT POLYGON to LatLngBounds
        let points = selectedObject.bbox.replace("POLYGON((", "").replace("))", "").split(",");
        mapRef.current?.fitBounds([[parseFloat(points[0].split(" ")[1]), parseFloat(points[0].split(" ")[0])], [parseFloat(points[2].split(" ")[1]), parseFloat(points[2].split(" ")[0])]]);
    }

    return (
        <>
            <Container size="lg" mt="60px">
                <Title order={3}>Select a region to explore</Title>
                <Text mt={10}>Select the type of region on the left. Click a name or click on the map to select a
                    region. Use map controls or shift-drag with your mouse to zoom the map.
                    Click the region button to explore occurrence records, images and documents associated with the
                    region.</Text>
                <Grid gutter={30} mt={20}>
                    <Grid.Col span="content">
                        <Box w={355}>
                            <Flex justify="flex-start" align="center" gap="5px">
                                <IconInfoCircleFilled size={16}/>
                                <Text fz={14}>Click on a region name to select an area</Text>
                            </Flex>
                            <Accordion defaultValue="" mt={20}>
                                {menuItems.map((item) => (
                                    <Accordion.Item key={item.label} value={item.fid || REGION_AGGREGATE}>
                                        <Accordion.Control>{item.label}</Accordion.Control>
                                        <Accordion.Panel>
                                            <Space h={10}/>
                                            <Box style={{overflowY: "scroll", maxHeight: "300px"}}>
                                                {item.fields && item.fields.map((field, idx) => (
                                                    <Flex onClick={() => setMapObject(field)} 
                                                            key={idx} style={{cursor: "pointer"}}>
                                                        <DotsOneIcon size={16}/>
                                                        <Text fz={14}>{field.name}</Text>
                                                    </Flex>
                                                ))}
                                                {item.objects && item.objects.map((obj, idx) => (
                                                    <Flex onClick={() => setMapObject(item as SelectedLayer, obj)}
                                                            key={idx} style={{cursor: "pointer"}}>
                                                        <DotsOneIcon size={16}/>
                                                        <Text fz={14} title={obj.description}>{obj.name}</Text>
                                                    </Flex>
                                                ))}
                                            </Box>
                                            <Space h={10}/>
                                        </Accordion.Panel>
                                    </Accordion.Item>)
                                )}
                            </Accordion>
                        </Box>
                    </Grid.Col>
                    <Grid.Col span="content">
                        <Box w={600}>
                            <Flex justify="flex-start" align="center" gap="5px" mb={10}>
                                {!selectedObject && <>
                                    <IconInfoCircleFilled size={16}/>
                                    <Text fz={14}>Click on the map to select an area.</Text>
                                </>}
                                {selectedObject && <>
                                    <Button variant="default" onClick={openObject}>{selectedObject.name}</Button>
                                    <Button variant="default" ml={30} onClick={zoomToObject}
                                            leftSection={<IconZoomIn/>}>Zoom to region</Button>
                                </>
                                }
                                <Button ml={30} variant="default"
                                        leftSection={<IconReload/>}
                                        onClick={resetMap}
                                        disabled={!mapStateChanged}>Reset map</Button>
                            </Flex>

                            <Box style={{cursor: "pointer !important"}}>
                                <MapContainer
                                    ref={mapRef}
                                    center={center}
                                    zoom={defaultZoom}
                                    scrollWheelZoom={false}
                                    worldCopyJump={true}
                                    style={{height: "530px", borderRadius: "10px"}}
                                >
                                    <MapStateUtil setMapStateChanged={setMapStateChanged}/>

                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                                        zIndex={1}
                                    />

                                    {selectedLayer && showLayer &&
                                        <WMSTileLayer
                                            url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon`}
                                            layers={`ALA:${selectedLayer.layerName}`}
                                            format="image/png"
                                            styles="polygon"
                                            transparent={true}
                                            opacity={layerOpacity / 100.0}
                                            zIndex={10}
                                        />
                                    }
                                    {selectedObject && showObject &&
                                        <WMSTileLayer
                                            url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon&viewparams=s%3A${selectedObject.pid}`}
                                            layers={`ALA:Objects`}
                                            format="image/png"
                                            styles="polygon"
                                            transparent={true}
                                            opacity={objectOpacity / 100.0}
                                            zIndex={11}
                                        />
                                    }
                                    {selectedObject &&
                                        <Popup position={selectedObject.latlng}>
                                            <Anchor onClick={openObject}>{selectedObject.name}</Anchor>
                                        </Popup>
                                    }
                                    <MapClickHandler onClick={handleMapClick}/>
                                </MapContainer>
                            </Box>
                            <Flex mt={20}>
                                <Checkbox checked={showLayer} size="16"
                                        onChange={(event) => setShowLayer(event.currentTarget.checked)}
                                        disabled={!selectedLayer}/><Text ml={10} fz={16}>All regions</Text>
                            </Flex>
                            <Slider value={layerOpacity} onChangeEnd={setLayerOpacity} disabled={!selectedLayer}/>
                            <Flex mt={20}>
                                <Checkbox checked={showObject} size="16"
                                        onChange={(event) => setShowObject(event.currentTarget.checked)}
                                        disabled={!selectedObject}/><Text ml={10} fz={16}>Selected region</Text>
                            </Flex>
                            <Slider value={objectOpacity} onChangeEnd={setObjectOpacity} disabled={!selectedObject}/>
                        </Box>
                    </Grid.Col>
                </Grid>
            </Container>
        </>
    );
}

export default Regions;
