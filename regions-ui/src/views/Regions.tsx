import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer, Popup} from 'react-leaflet';

import FontAwesomeIcon from '../components/icon/fontAwesomeIconLite'
import {faCircle, faInfoCircle, faSearchPlus} from '@fortawesome/free-solid-svg-icons';
import {faRedo} from '@fortawesome/free-solid-svg-icons';
import './regions.css'
import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useNavigate} from "react-router-dom";
import {Accordion, Col, Container, Row} from "react-bootstrap";
import {Breadcrumb} from "../api/sources/model.ts";
import DualRangeSlider from "../components/common-ui/dualRangeSlider.tsx";


const REGION_AGGREGATE = "OTHER_REGIONS";
const center = new LatLng(Number(import.meta.env.VITE_MAP_CENTRE_LAT), Number(import.meta.env.VITE_MAP_CENTRE_LNG));
const OBJECT_OPACITY = 100;
const LAYER_OPACITY = 60;
const defaultZoom = import.meta.env.VITE_MAP_DEFAULT_ZOOM;

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
    useMapEvents(handlers)

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

interface RegionsProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}

function Regions({setBreadcrumbs}: RegionsProps) {

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
            {title: "Home", href: import.meta.env.VITE_HOME_URL},
            {title: "Explore", href: import.meta.env.VITE_EXPLORE_URL},
            {title: "Regions", href: ""}
        ])

        const url = `${import.meta.env.VITE_REGIONS_CONFIG_URL}`;
        const regionsConfig = fetch(url).then((response) => response.json());

        regionsConfig.then((json) => {
            // regionsConfig is a list, iterate through items

            const list = [];
            for (const region of json) {
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
                setMapObject(selectedLayer, {pid: pid, name: label, bbox: data2.bbox, description: data2.description});
            }
        }
    };

    function setMapObject(layer: SelectedLayer, obj: SelectedObject | undefined = undefined) {
        setMapStateChanged(true);

        // using a reset-to-null + timeout, not the best way to do this
        if (selectedLayer && selectedLayer.layerName != layer.layerName) {
            setSelectedLayer(null);

            // reset zoom if the layer changes
            mapRef.current?.setView(center, defaultZoom);
        }
        if (selectedObject && obj && selectedObject.pid != obj.pid) {
            setSelectedObject(null);
        } else if (!obj && selectedObject) {
            setSelectedObject(null);
        } else if (obj && selectedObject && selectedObject.pid == obj.pid) {
            openObject(); // opens the item if clicked twice in a row
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

    function updateLayer(layerId: any) {
        // find the menuItem with fid == layerId
        const menuItem = menuItems.find((item) => item.fid == layerId);
        if (menuItem) {
            setMapObject(menuItem as SelectedLayer);
        }
    }

    return (
        <>
            <Container className="mt-5">
                <h2>Select a region to explore</h2>
                <p>Select the type of region on the left. Click a name or click on the map to select a
                    region. Use map controls or shift-drag with your mouse to zoom the map.
                    Click the region button to explore occurrence records, images and documents associated with the
                    region.</p>
                <Row className="mt-4">
                    <Col className="col-md-4">
                        <div style={{width: '355px'}}>
                            <div className="d-flex align-items-center gap-2">
                                <FontAwesomeIcon icon={faInfoCircle} size="lg"/>
                                <p className="mb-0">Click on a region name to select an area</p>
                            </div>
                            <Accordion defaultActiveKey="" className="mt-4"
                                       onSelect={(layerId) => updateLayer(layerId)}>
                                {menuItems.map((item) => (
                                    <Accordion.Item key={item.label} eventKey={item.fid || REGION_AGGREGATE}>
                                        <Accordion.Header>
                                            {item.label}</Accordion.Header>
                                        <Accordion.Body>
                                            <div style={{overflowY: 'scroll', maxHeight: '300px'}}>
                                                {item.fields && item.fields.map((field, idx) => (
                                                    <div onClick={() => setMapObject(field)}
                                                         key={idx} style={{cursor: 'pointer'}}
                                                         className="d-flex align-items-center">
                                                        <FontAwesomeIcon icon={faCircle} className="smallIcon"/>
                                                        <p className="mb-1 ms-2">{field.name}</p>
                                                    </div>
                                                ))}
                                                {item.objects && item.objects.map((obj, idx) => (
                                                    <div onClick={() => setMapObject(item as SelectedLayer, obj)}
                                                         key={idx} style={{cursor: 'pointer'}}
                                                         className="d-flex align-items-center">
                                                        <FontAwesomeIcon icon={faCircle} className="smallIcon"/>
                                                        <p className="mb-1 ms-2" title={obj.description}>{obj.name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        </div>
                    </Col>
                    <Col className="col-md-8">
                        <div style={{width: '600px'}}>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                {!selectedObject && <>
                                    <FontAwesomeIcon icon={faInfoCircle}/>
                                    <p className="mb-0">Click on the map to select an area.</p>
                                </>}
                                {selectedObject && <>
                                    <button className="btn btn-default" onClick={openObject}>{selectedObject.name}</button>
                                    <button className="btn btn-default ms-3" onClick={zoomToObject}>
                                        <FontAwesomeIcon icon={faSearchPlus}/> Zoom to region
                                    </button>
                                </>}
                                <button className="btn btn-default ms-3" onClick={resetMap}
                                        disabled={!mapStateChanged}>
                                    <FontAwesomeIcon icon={faRedo}/> Reset map
                                </button>
                            </div>

                            <div style={{cursor: 'pointer !important'}}>
                                <MapContainer
                                    ref={mapRef}
                                    center={center}
                                    zoom={defaultZoom}
                                    scrollWheelZoom={false}
                                    worldCopyJump={true}
                                    style={{height: '530px', borderRadius: '10px'}}
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
                                            <a onClick={openObject}>{selectedObject.name}</a>
                                        </Popup>
                                    }
                                    <MapClickHandler onClick={handleMapClick}/>
                                </MapContainer>
                            </div>
                            <div className="mt-3">
                                <div className="d-flex mb-2">
                                    <input
                                        type="checkbox"
                                        checked={showLayer}
                                        onChange={(event) => setShowLayer(event.currentTarget.checked)}
                                        disabled={!selectedLayer}
                                    />
                                    <div className="ms-2">All regions</div>
                                </div>
                                <DualRangeSlider min={0} max={100} minValue={layerOpacity} maxValue={100} stepSize={1}
                                                 onChange={(minVal) => {
                                                     setLayerOpacity(Math.floor(minVal));
                                                 }}
                                                 isDisabled={!showLayer || !selectedLayer}
                                                 singleValue={true}/>
                            </div>
                            <div className="mt-3">
                                <div className="d-flex mb-2">
                                    <input
                                        type="checkbox"
                                        checked={showObject}
                                        onChange={(event) => setShowObject(event.currentTarget.checked)}
                                        disabled={!selectedObject}
                                    />
                                    <div className="ms-2">Selected region</div>
                                </div>
                                <DualRangeSlider min={0} max={100} minValue={objectOpacity} maxValue={100} stepSize={1}
                                                 onChange={(minVal) => {
                                                     setObjectOpacity(Math.floor(minVal));
                                                 }}
                                                 isDisabled={!showObject || !selectedObject}
                                                 singleValue={true}/>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        </>
    );
}

export default Regions;
