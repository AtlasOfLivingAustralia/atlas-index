import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer, Popup, LayersControl} from 'react-leaflet';
import FontAwesomeIcon from '../components/common-ui/fontAwesomeIconLite.tsx'
import {faCircle, faInfoCircle, faSearchPlus} from '@fortawesome/free-solid-svg-icons';
import {faRedo} from '@fortawesome/free-solid-svg-icons';
import styles from './Regions.module.css';
import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useNavigate} from "react-router-dom";
import {Accordion, Container} from "react-bootstrap";
import {Breadcrumb} from "../api/sources/model.ts";
import DualRangeSlider from "../components/common-ui/dualRangeSlider.tsx";
import ReactLeafletGoogleLayer from 'react-leaflet-google-layer';
import useHashState from "../components/util/useHashState.tsx";

// defaults
const REGION_AGGREGATE = "OTHER_REGIONS";
const center = new LatLng(Number(import.meta.env.VITE_MAP_CENTRE_LAT), Number(import.meta.env.VITE_MAP_CENTRE_LNG));
const OBJECT_OPACITY = 100;
const LAYER_OPACITY = 60;
const defaultZoom = import.meta.env.VITE_MAP_DEFAULT_ZOOM;

// SelectedLayer is a layer on the map
interface SelectedLayer {
    label?: string; // used by ordinary layers
    name?: string; // used by REGION_AGGREGATE layers
    layerName: string;
    fid: string;
}

// SelectedObject is a region that belongs to a layer on the map
interface SelectedObject {
    pid: string;
    name: string;
    bbox: string;
    description?: string;
    latlng?: [number, number];
}

// MenuItem is a layer or object in the accordion
interface MenuItem {
    label: string;
    layerName: string;
    fid?: string;
    objects?: any[];
    fields?: any[];
}

/**
 * For enabling the map reset button after a map event (zoom, pan, etc)
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

/**
 * For handling map click events, for region intersections
 *
 * @param onClick callback function
 * @returns
 */
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

/**
 * Regions page. Allows the user to select from a list of layers and display it on a map.
 * Allows the user to select an area from this layer from a list or from interacting with
 * the map. Based on the existing regions app.
 *
 * The hash in the URL is used to store the selected layer and region.
 *
 * @param setBreadcrumbs
 * @constructor
 */
function Regions({setBreadcrumbs}: RegionsProps) {

    // extract params state from the URL
    const [defaultLayer, setDefaultLayer] = useState<string | null>(null);
    const [mapStateChanged, setMapStateChanged] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
    const [selectedLayer, setSelectedLayer] = useState<SelectedLayer | null>(null);
    const [layerName, setLayerName] = useHashState<string | null>('layer', null);
    const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);
    const [objectName, setObjectName] = useHashState<string | null>('region', null);
    const [showLayer, setShowLayer] = useState(true);
    const [showObject, setShowObject] = useState(true);
    const [objectOpacity, setObjectOpacity] = useState(OBJECT_OPACITY);
    const [layerOpacity, setLayerOpacity] = useState(LAYER_OPACITY);

    const navigate = useNavigate();
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: "Home", href: import.meta.env.VITE_HOME_URL},
            {title: "Explore", href: import.meta.env.VITE_EXPLORE_URL},
            {title: "Regions", href: ""}
        ])

        // load the regions config from an external source
        const url = `${import.meta.env.VITE_REGIONS_CONFIG_URL}`;
        const regionsConfig = fetch(url).then((response) => response.json());

        regionsConfig.then((json) => {
            const list = [];
            var newDefaultLayer = null;
            var newRegion = null;
            var openRegionAggregates = false;
            for (const region of json) {
                list.push({
                    label: region.name,
                    layerName: region.layerName,
                    fid: region.fid,
                    objects: region.objects,
                    fields: region.fields
                });

                //  use the first layer as the default open accordion unless otherwise specified
                if (newDefaultLayer == null) {
                    newDefaultLayer = region;
                } else if (region.name == layerName) {
                    newDefaultLayer = region;
                }

                // iterate through objects to match initialRegion
                if (region.objects) {
                    for (const obj of region.objects) {
                        if (obj.name == objectName) {
                            newRegion = obj;
                        }
                    }
                }

                // iterate through fields to match initialRegion
                if (region.fields) {
                    for (const obj of region.fields) {
                        if (obj.name == objectName) {
                            newRegion = obj;
                        }

                        // when an "other layers" layer is selected, open the region aggregates and
                        // prepare to add this layer to the map
                        if (obj.name == layerName) {
                            openRegionAggregates = true;
                            newDefaultLayer = obj;
                        }
                    }
                }
            }
            setMenuItems(list);

            // open the correct accordion
            setDefaultLayer(layerName === REGION_AGGREGATE || openRegionAggregates ? REGION_AGGREGATE : newDefaultLayer.fid);

            // map the initial layer and region
            if (newRegion) {
                setMapObject({
                        label: newDefaultLayer.name,
                        fid: newDefaultLayer.fid,
                        layerName: newDefaultLayer.layerName
                    }, newRegion);
            } else if (newDefaultLayer && layerName !== REGION_AGGREGATE) {
                setMapObject({
                    label: newDefaultLayer.name,
                    fid: newDefaultLayer.fid,
                    layerName: newDefaultLayer.layerName
                });
            }
        })
    }, []);

    // reset map zoom and center
    const resetMap = () => {
        mapRef.current?.setView(center, defaultZoom);
        setMapStateChanged(false);
    }

    // identify the region that was clicked on the map, select and highlight it (as a new map layer)
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

    // perform mapping of a layer and one object, as separate layers
    function setMapObject(layer: SelectedLayer, obj: SelectedObject | undefined = undefined) {
        setMapStateChanged(true);

        // using a reset-to-null + timeout, not the best way to do this
        if (selectedLayer && selectedLayer.layerName != layer.layerName) {
            setSelectedLayer(null);

            // reset zoom if the layer changes
            mapRef.current?.setView(center, defaultZoom);
        }

        // Not the best mechanism to trigger map layer updates:
        // - set to null, then set to the new value after a timeout
        if (selectedObject && obj && selectedObject.pid != obj.pid) {
            setSelectedObject(null);
        } else if (!obj && selectedObject) {
            setSelectedObject(null);
            setObjectName(null);
        } else if (obj && selectedObject && selectedObject.pid == obj.pid) {
            openObject(); // opens the item if clicked twice in a row
        }
        setTimeout(() => {
            setSelectedLayer({layerName: layer.layerName, fid: layer.fid, label: layer.label || layer.name});
            setLayerName(layer.label || layer.name || null)
            if (obj) {
                // convert bbox WKT POLYGON to center latlng
                let points = obj.bbox.replace("POLYGON((", "").replace("))", "").split(",");
                obj.latlng = [(parseFloat(points[0].split(" ")[1]) + parseFloat(points[2].split(" ")[1])) / 2, (parseFloat(points[0].split(" ")[0]) + parseFloat(points[2].split(" ")[0])) / 2];
                setSelectedObject(obj);
                setObjectName(obj.name); // should not be setting this when REGION_AGGREGATE is selected
            } else {
                setObjectName(null);
            }
        }, 5); // 5ms to wait for the map to update for the null values
    }

    // navigate to the region page for the selectedObject
    function openObject() {
        if (!selectedObject) {
            return;
        }
        navigate(`/region?id=${selectedObject.pid}`);
        window.location.hash = ''; // clear the hash as part of the navigation change, not strictly necessary
    }

    // zoom to the selectedObject
    function zoomToObject() {
        if (!selectedObject) {
            return;
        }

        // convert bbox WKT POLYGON to LatLngBounds
        let points = selectedObject.bbox.replace("POLYGON((", "").replace("))", "").split(",");
        mapRef.current?.fitBounds([[parseFloat(points[0].split(" ")[1]), parseFloat(points[0].split(" ")[0])], [parseFloat(points[2].split(" ")[1]), parseFloat(points[2].split(" ")[0])]]);

        // enable the map reset button
        setMapStateChanged(true);
    }

    // perform changes required when toggling accordions open/closed
    function updateLayer(layerId: any) {
        // find the menuItem with fid == layerId
        if (!menuItems) {
            return;
        }

        const menuItem = menuItems.find((item) => item.fid == layerId);
        if (layerId == REGION_AGGREGATE || layerId == null) {
            // update the URL, without reloading
            setSelectedObject(null);
            setObjectName(null);
            setLayerName(REGION_AGGREGATE);
        } else if (menuItem) {
            setMapObject(menuItem as SelectedLayer);
        }
    }

    return (
        <>
            <Container className="mt-5">
                <div >
                    <h2>Select a region to explore</h2>
                    <p>Select the type of region on the left. Click a name or click on the map to select a
                        region. Use map controls or shift-drag with your mouse to zoom the map.
                        Click the region button to explore occurrence records, images and documents associated with the
                        region.</p>
                </div>
                <div className={styles.panels}>
                    <div className={styles.layersPanel}>
                        <div className="d-flex align-items-center gap-2">
                            <FontAwesomeIcon icon={faInfoCircle} size="lg"/>
                            <p className="mb-0">Click on a region name to select an area</p>
                        </div>
                        {defaultLayer && menuItems &&
                            <Accordion defaultActiveKey={defaultLayer} className="mt-4"
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
                                                        <FontAwesomeIcon icon={faCircle} className={styles.smallIcon}/>
                                                        <p className="mb-1 ms-2">{field.name}</p>
                                                    </div>
                                                ))}
                                                {item.objects && item.objects.map((obj, idx) => (
                                                    <div onClick={() => setMapObject(item as SelectedLayer, obj)}
                                                         key={idx} style={{cursor: 'pointer'}}
                                                         className="d-flex align-items-center">
                                                        <FontAwesomeIcon icon={faCircle} className={styles.smallIcon}/>
                                                        <p className="mb-1 ms-2"
                                                           title={obj.description}>{obj.name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        }
                    </div>
                    <div className={styles.mapPanel}>
                        <div className={styles.rightPanel}>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                {!selectedObject && <>
                                    <FontAwesomeIcon icon={faInfoCircle}/>
                                    <p className="mb-0">Click on the map to select an area.</p>
                                </>}
                                {selectedObject && <>
                                    <button className="btn btn-sm btn-default"
                                            onClick={openObject}>{selectedObject.name}</button>
                                    <button className="btn btn-sm btn-default ms-3" onClick={zoomToObject}>
                                        <FontAwesomeIcon icon={faSearchPlus}/> Zoom to region
                                    </button>
                                </>}
                                <button className="btn btn-sm btn-default ms-3" onClick={resetMap}
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
                                    className={styles.map}
                                >
                                    <MapStateUtil setMapStateChanged={setMapStateChanged}/>

                                    <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="Minimal">
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL}
                                                zIndex={1}
                                            />
                                        </LayersControl.BaseLayer>
                                        {import.meta.env.VITE_GOOGLE_MAP_API_KEY &&
                                            <>
                                                <LayersControl.BaseLayer name="Road">
                                                    <ReactLeafletGoogleLayer
                                                        apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                        type={'roadmap'}/>
                                                </LayersControl.BaseLayer>
                                                <LayersControl.BaseLayer name="Terrain">
                                                    <ReactLeafletGoogleLayer
                                                        apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                        type={'terrain'}/>
                                                </LayersControl.BaseLayer>
                                                <LayersControl.BaseLayer name="Satellite">
                                                    <ReactLeafletGoogleLayer
                                                        apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                        type={'satellite'}/>
                                                </LayersControl.BaseLayer>
                                            </>
                                        }
                                    </LayersControl>

                                    {selectedLayer && showLayer && layerName != REGION_AGGREGATE &&
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
                                            <a onClick={openObject} className={styles.selectedObject}>{selectedObject.name}</a>
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
                    </div>
                </div>
            </Container>
        </>
    );
}

export default Regions;
