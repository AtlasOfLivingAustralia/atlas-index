import {
    Circle,
    FeatureGroup,
    LayerGroup,
    LayersControl,
    MapContainer,
    Marker,
    Popup,
    Rectangle,
    TileLayer
} from 'react-leaflet';
import { FullscreenControl } from "react-leaflet-fullscreen";
import "react-leaflet-fullscreen/styles.css";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {DataQualityInfo} from "../../api/sources/model.ts";
import {useEffect, useRef} from "react";

const center = new LatLng(-22, 131)

interface MapViewProps {
    queryString?: string,
    dataQualityInfo?: DataQualityInfo,
    tab?: string
}

function MapView({queryString, dataQualityInfo, tab}: MapViewProps) {

    const mapRef = useRef(null);

    useEffect(() => {
        if (tab === 'map') {
            setTimeout(() => {
                // @ts-ignore
                mapRef.current?.invalidateSize(false);
            }, 300); // Adjust timeout to tab transition
        }
    }, [tab]);

    return <>
        <div>
            <MapContainer ref={mapRef} center={center} zoom={4} scrollWheelZoom={false} worldCopyJump={true}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                />
                <FullscreenControl position={"topleft"}/>
            </MapContainer>
        </div>
    </>
}

export default MapView;
