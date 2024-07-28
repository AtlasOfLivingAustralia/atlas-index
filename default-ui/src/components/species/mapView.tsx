import {
    MapContainer,
    TileLayer
} from 'react-leaflet';
import {FullscreenControl} from "react-leaflet-fullscreen";
import "react-leaflet-fullscreen/styles.css";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {useEffect, useRef, useState} from "react";

const center = new LatLng(-22, 131)

interface MapViewProps {
    queryString?: string,
    tab?: string,
    result?: {}
}

function MapView({queryString, tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [distributions, setDistributions] = useState([]);

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

    return <>

        <div className="speciesConservation d-flex">
            <div className="bi bi-flag-fill speciesConservationFlag"></div>
            <div>This species is considered sensitive in at least one jurisdiction. Some or all occurrence data has been
                obfuscated. <span className="speciesInvasiveLink">More info</span></div>
        </div>

        <div className="speciesOccurrenceCount">
            {occurrenceCount >= 0 && <>
                {formatNumber(occurrenceCount)}
                <span className="speciesOccurrenceCountTxt  "> occurrence records</span>
            </>}
        </div>

        <div className="d-flex">
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

                <div className="speciesMapControlItem speciesMapControlItemHr">
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
        </div>
        <div className="speciesMapAbout">
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
        </div>
    </>
}

export default MapView;
