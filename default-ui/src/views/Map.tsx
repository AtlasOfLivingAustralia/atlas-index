import {useEffect, useRef, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import 'ol/ol.css';
import {Control, ScaleLine} from "ol/control";
import {FullScreen, defaults as defaultControls} from 'ol/control.js';
import {createRoot} from "react-dom/client";

function MapView({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {
    const [infoString, setInfoString] = useState('');
    const [map, setMap] = useState();
    const mapElement = useRef();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Map', href: '/map'}
        ]);

        const myControlDiv = document.createElement('div');
        // TODO: find the missing style or Control config because the button is in the wrong place
        createRoot(myControlDiv).render(<div className="rotate-north ol-unselectable ol-control">
            <button>hello</button>
        </div>);

        // when in development mode setMap is called twice and two maps are created, so do not do that
        // @ts-ignore
        if (mapElement && mapElement.current && mapElement.current.childElementCount === 0) {
            const initialMap = new Map({
                target: mapElement.current,
                view: new View({
                    center: [15348777, -2596953, 0], // EPSG:3857 for somewhere in Australia
                    zoom: 1,
                }),
                layers: [
                    new TileLayer({
                        source: new OSM({url: 'https://spatial.ala.org.au/osm/{z}/{x}/{y}.png'})
                    }),
                ],
                controls: defaultControls().extend([new FullScreen(), new Control({
                    element: myControlDiv,
                })]),
                // interactions: defaultInteractions().extend([new DragRotateAndZoom()]),
            });

            initialMap.addControl(new ScaleLine({units: 'metric'}));

            // @ts-ignore
            setMap(initialMap);
        }
    }, []);

    function getInfo() {
        if (map) {
            // @ts-ignore
            const view = map.getView();
            const zoom = view.getZoom();
            const center = view.getCenter();
            const projection = view.getProjection();
            const resolution = view.getResolution();
            const rotation = view.getRotation();
            const info = {
                zoom,
                center,
                projection,
                resolution,
                rotation
            };
            setInfoString(JSON.stringify(info, null, 2));
        }
    }

    function mapDiv() {
        // @ts-ignore
        return <div ref={mapElement} style={{height: "400px", width: "100%"}}/>
    }

    return (
        <>
            <div className="container-fluid">
                    <>
                        {mapDiv()}

                        <button className="btn border-black" onClick={() => getInfo()}>get info</button>
                        <pre className="font-monospace">{infoString}</pre>
                    </>

            </div>
        </>
    );
}

export default MapView;
