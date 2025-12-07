/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    MapContainer,
    TileLayer
} from 'react-leaflet';
import { FullscreenControl } from "react-leaflet-fullscreen";
import "react-leaflet-fullscreen/styles.css";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useEffect, useRef} from "react";
import {DataQualityInfo} from "../api/model.tsx";

const center = new LatLng(-22, 131)

interface MapViewProps {
    queryString?: string,
    dataQualityInfo?: DataQualityInfo,
    tab?: string
}

function MapView({tab}: MapViewProps) {

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
