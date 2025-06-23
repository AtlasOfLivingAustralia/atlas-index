/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from "react";
import {LayersControl, MapContainer, TileLayer, WMSTileLayer} from 'react-leaflet';
import {LatLng, LayersControlEvent} from "leaflet";
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import ReactLeafletGoogleLayer from "react-leaflet-google-layer";

import 'leaflet/dist/leaflet.css';
import classes from "./species.module.css";
import Legend from "./mapLegend";
import Control from "react-leaflet-custom-control";
import FormatName from "../nameUtils/formatName";
import InfoBox from "../common-ui/infoBox.tsx";
import FlaggedAlert from "../common-ui/flaggedAlert.tsx";
import FontAwesomeIcon from "../common-ui/fontAwesomeIconLite.tsx";
import {faRotateRight} from '@fortawesome/free-solid-svg-icons';
import refineSection from "../common-ui/refineSection.tsx";

interface MapViewProps {
    queryString?: string;
    tab?: string;
    result?: Record<PropertyKey, string | number | any>;
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

function MapView({tab, result}: MapViewProps) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [showOccurrences, setShowOccurrences] = useState(true);
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [hexValuesScaled, setHexValuesScaled] = useState(false);
    const mapRef = useRef<L.Map | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [hexBinValues, setHexBinValues] = useState<[string, number | null][]>([
        ["FFC577", 1],
        ["E28946", 10],
        ["D36B3D", 100],
        ["C44D34", 1000],
        ["802937", null]
    ]); // Note the count values are scaled by a factor below
    const recordLayerOpacity = import.meta.env.VITE_MAP_LAYER_OPACITY;
    const defaultZoom = import.meta.env.VITE_MAP_DEFAULT_ZOOM;
    const center = new LatLng(import.meta.env.VITE_MAP_CENTRE_LAT, import.meta.env.VITE_MAP_CENTRE_LNG);

    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        function handleOverlayAdd(e: LayersControlEvent) {
            updateLayerVisibilityState(e, true);
        }

        function handleOverlayRemove(e: LayersControlEvent) {
            updateLayerVisibilityState(e, false);
        }

        map.on("overlayadd", handleOverlayAdd);
        map.on("overlayremove", handleOverlayRemove);

        return () => {
            map.off("overlayadd", handleOverlayAdd);
            map.off("overlayremove", handleOverlayRemove);
        };

    }, [mapReady, distributions, showOccurrences]); //distributions and showOccurrences are required by updateLayerVisibilityState

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
            setShowOccurrences(true); // Workaround to update records layer when taxon changes

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
        setHexBinValues(hexBinValuesScaled);
        setHexValuesScaled(true); // keep track of scaling "state"
    }, [occurrenceCount]);

    function updateLayerVisibilityState(e: LayersControlEvent, isVisible: boolean) {
        if (e.name == "Occurrence records") {
            setShowOccurrences(isVisible);
            return;
        }
        for (const dist of distributions) {
            if (e.name === dist.areaName + ", " + dist.dataResourceName) {
                const updatedDistributions = distributions.map(d =>
                    d.areaName + ", " + d.dataResourceName === dist.areaName + ", " + dist.dataResourceName ? {
                        ...d,
                        checked: isVisible
                    } : d
                );
                setDistributions(updatedDistributions);
                return;
            }
        }
    }

    function formatNumber(occurrenceCount: any) {
        return occurrenceCount.toLocaleString();
    }

    function createAlertForTaxon() {
        if (!result?.guid) {
            return "";
        }

        // Produces an alert identical to biocache-hubs
        const query = `/occurrences/search?q=lsid:${encodeURIComponent(result?.guid)}${import.meta.env.VITE_GLOBAL_FQ}`;
        const url = `${import.meta.env.VITE_APP_ALERTS_URL}/webservice/createBiocacheNewRecordsAlert?webserviceQuery=${query}&uiQuery=${query}&queryDisplayName=${result?.name}&baseUrlForWS=${import.meta.env.VITE_APP_BIOCACHE_URL}&baseUrlForUI=${import.meta.env.VITE_APP_BIOCACHE_UI_URL}&resourceName=${import.meta.env.VITE_APP_ALERT_RESOURCE_NAME}`;
        return url;
    };

    const onlineResources: OnlineResource[] = [
        {
            name: <>Explore and download <br/>occurrence records</>,
            url: `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:${encodeURIComponent(result?.guid)}`
        },
        {
            name: "Advanced mapping",
            url: `${import.meta.env.VITE_SPATIAL_URL}?q=lsid:${encodeURIComponent(result?.guid)}`
        },
        {
            name: <>How to submit <br/>observations</>,
            url: "https://www.ala.org.au/home/record-a-sighting/"
        },
        {
            name: <>Receive alerts for <br/>new records</>,
            url: createAlertForTaxon()
        }
    ];

    function getAlaWmsUrl() {
        if (!result?.guid) {
            return '';
        }
        const hexBinParam = hexBinValues.join(',').replace(/,$/, '');
        const wmsUrl = `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=lsid:${encodeURIComponent(result.guid)}&OUTLINE=false&ENV=size:3;colormode:hexbin;color:${hexBinParam}`;
        return wmsUrl;
    }

    function generateDistributionMapObj(distributions: Distribution[] | string | null) {
        let spatialObjects: Distribution[] = [];

        // Utility function to add 'url' and 'checked' attrs to distribution object (state management)
        const augmentDistroData = (distros: Distribution[]): Distribution[] => {
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

    if (!result || !result.guid) {
        return <></>
    }

    return <>
        {result.sdsStatus &&
            <FlaggedAlert content={<>
                This species is <strong>considered sensitive</strong> in at least one jurisdiction.
                Some or all occurrence data has been obfuscated.&nbsp;
                <a
                    href={import.meta.env.VITE_SDS_INFO_URL}
                    style={{textDecoration: "underline", color: "#228be6"}}>
                    More info
                </a>.</>}
                          style={{marginBottom: "40px"}}/>
        }
        <InfoBox icon={faCircleInfo} title="About this map"
                 content={<>Occurrence records show where a species has been recorded, and may not show the full extent
                     of its known
                     distribution. Records may contain some error. Expert distributions show species distributions
                     modelled by
                     experts or the coarse known distributions of species.</>}
        />
        <div className="d-flex flex-row gap-3" style={{marginTop: "30px"}}>
            <div style={{display: "relative", paddingLeft: "5px"}}>

                <span className={classes.refineTitle} style={{display: "block"}}>Refine map</span>

                {refineSection("Occurrence records", [
                    {
                        label: "Show occurrence records",
                        onClick: () => setShowOccurrences((prev) => !prev),
                        isOpen: showOccurrences,
                        isDisabled: () => false
                    }
                ])}

                {distributions && distributions.length > 0 && refineSection("Expert distributions", distributions.map((dist, idx) => ({
                    label: (<>
                        {dist.areaName}
                        <span style={{display: "block", fontStyle: "italic", cursor: "default"}}
                              onClick={e => e.stopPropagation()}>
                                  provided by&nbsp;
                            <a href={dist.dataResourceUid ? `${import.meta.env.VITE_COLLECTIONS_URL}/public/show/${dist.dataResourceUid}` : '#'}
                               style={{
                                   color: "#228be6",
                                   textDecoration: "underline"
                               }}>{dist.dataResourceName}</a></span>
                    </>),
                    onClick: () => {
                        const updatedDistributions = distributions.map((d, i) =>
                            i === idx ? {...d, checked: !d.checked} : d
                        );
                        setDistributions(updatedDistributions);
                    },
                    isOpen: dist.checked || false,
                    isDisabled: () => distributions.length === 0
                })))}

                {distributions && distributions.length === 0 &&
                    <span style={{fontSize: "0.875rem", color: "grey", display: "block"}}>
                      No expert distribution maps available for <FormatName name={result?.name}
                                                                            rankId={result?.rankID}/>
                    </span>
                }
            </div>
            <div style={{
                height: "100%",
                width: "100%",
                borderRadius: "10px",
            }}>
                <span style={{marginBottom: "15px", display: "block"}}
                      className={classes.refineTitle}>{formatNumber(occurrenceCount)} occurrence records</span>
                <div style={{position: "relative"}}>
                    <MapContainer
                        ref={mapRef}
                        center={center}
                        zoom={defaultZoom}
                        scrollWheelZoom={false}
                        worldCopyJump={true}
                        style={{height: "530px", borderRadius: "10px"}}
                        whenReady={() => setMapReady(true)}
                    >
                        {import.meta.env.VITE_GOOGLE_MAP_API_KEY &&
                            <LayersControl position="topright">
                                <LayersControl.BaseLayer checked name="Minimal">
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL}
                                    />
                                </LayersControl.BaseLayer>
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

                                <LayersControl.Overlay
                                    checked={true}
                                    name="Occurrence records"
                                >
                                    <WMSTileLayer
                                        url={getAlaWmsUrl()}
                                        layers="ALA:occurrences"
                                        format="image/png"
                                        transparent={true}
                                        opacity={recordLayerOpacity}
                                        attribution="Atlas of Living Australia"
                                        zIndex={15}
                                    />
                                </LayersControl.Overlay>

                                {distributions.map((dist, idx) => (
                                    <LayersControl.Overlay
                                        key={idx}
                                        checked={dist.checked}
                                        name={dist.areaName + ", " + dist.dataResourceName}
                                    >
                                        <WMSTileLayer
                                            url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon&viewparams=s:${dist.geomIdx}&`}
                                            layers="ALA:Distributions"
                                            format="image/png"
                                            styles="polygon"
                                            transparent={true}
                                            opacity={0.6}
                                            attribution={dist.dataResourceName}
                                            zIndex={20}
                                        />
                                    </LayersControl.Overlay>
                                ))}
                            </LayersControl>
                        }
                        <Control prepend position='bottomleft'>
                            {showOccurrences && hexValuesScaled &&
                                <Legend fillOpacity={recordLayerOpacity} hexBinValues={hexBinValues}/>
                            }
                        </Control>

                        <Control position="topleft" prepend={false}>
                            <button
                                style={{
                                    width: "34px",
                                    height: "36px",
                                    lineHeight: "34px",
                                    backgroundColor: "#FFF",
                                    border: "2px solid rgba(0, 0, 0, 0.2)",
                                    borderRadius: "4px",
                                    backgroundClip: "padding-box"
                                }}
                                aria-label="Reset map"
                                onClick={() =>
                                    mapRef.current && mapRef.current.setView(center, defaultZoom)
                                }>
                                <div style={{marginTop: "-1px"}}>
                                    <FontAwesomeIcon icon={faRotateRight} style={{lineHeight: "10px"}}/>
                                </div>
                            </button>
                        </Control>
                    </MapContainer>
                </div>
            </div>
        </div>
        <hr className={classes.hrColour} style={{marginTop: "30px", marginBottom: "40px"}}/>
        <span className={classes.speciesDescriptionTitle}>Getting started</span>
        <div className="d-flex flex-wrap" style={{rowGap: "40px", columnGap: "30px", marginTop: "30px"}}>
            {onlineResources.map((resource, idx) => (
                <a href={resource.url} key={idx} className="btn ala-btn-primary ala-btn-large">
                    {resource.name}
                </a>
            ))}
        </div>
    </>
}

export default MapView;
