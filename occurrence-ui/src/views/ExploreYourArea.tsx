/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, FontAwesomeIconLite, useHashState} from "@ala/common-ui";
import {LatLng, LeafletMouseEvent} from "leaflet";
import {useEffect, useState, useRef, useCallback} from "react";
import '../css/search.css';
import ReactDOM from "react-dom/client";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import ReactLeafletGoogleLayer from 'react-leaflet-google-layer';
import {SpeciesGroup, SpeciesGroupItem, SpeciesListItem} from "../api/model.tsx";
import styles from './exploreYourArea.module.css';
import speciesGroupMapImport from '../config/speciesGroupsMap.json';
import {Circle, LayersControl, MapContainer, Marker, TileLayer, WMSTileLayer} from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner';
import {faLocationArrow} from '@fortawesome/free-solid-svg-icons/faLocationArrow';
import L from "leaflet";
import React from "react";

const globalFq = import.meta.env.VITE_GLOBAL_FQ;

// TODO: use the i18n value "all.species"
const ALL_SPECIES = 'All Species';
const speciesGroups: SpeciesGroupItem[] = [
    {
        name: ALL_SPECIES,
        indent: 0,
    },
];
const insertFlatSpeciesGroups = (
    group: SpeciesGroup[],
    indent: number = 0
): void => {
    group.forEach((thisGroup) => {
        speciesGroups.push({
            name: thisGroup.name,
            indent: indent,
        });
        if (thisGroup.children) {
            insertFlatSpeciesGroups(thisGroup.children, indent + 1);
        }
    });
};
insertFlatSpeciesGroups(Object.values(speciesGroupMapImport), 1);


interface SpeciesGroupFacet {
    [key: string]: {
        count: number;
        name: string;
        speciesCount: number;
        level: number;
    };
};

// defaults
const center = new LatLng(
    Number(import.meta.env.VITE_EYA_DEFAULT_LAT),
    Number(import.meta.env.VITE_EYA_DEFAULT_LNG)
);
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);

function ExploreYourArea({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [locationText, setLocationText] = useState<string>('');
    const [addressText, setAddressText] = useState<string>('');
    const [latLngText, setLatLngText] = useHashState<string>('latlng', '');
    const [radius, setRadius] = useHashState('radius', 5);
    const [latLng, setLatLng] = useState<LatLng | null>(null);

    const [showOccurrences, setShowOccurrences] = useState(true);
    const [occurrenceFq, setOccurrenceFq] = useState('');
    const [speciesGroupFacet, setSpeciesGroupFacet] = useState<SpeciesGroupFacet>({});
    const [speciesList, setSpeciesList] = useState<
        SpeciesListItem[] | undefined
    >(undefined);

    const [speciesSort, setSpeciesSort] = useHashState<string>('speciesSort', 'records');

    const [isFetchingSpeciesList, setIsFetchingSpeciesList] = useState(false);
    const [selectedSpecies, setSelectedSpecies] = useHashState<string | null>(
        'species',
        null
    );
    const [group, setGroup] = useHashState<string>('group', ALL_SPECIES);

    // map popup state
    const [mapLookupLatLng, setMapLookupLatLng] = useState<LatLng | null>(null);
    const [mapLookupQueryParams, setMapLookupQueryParams] = useState<string>('');
    const [mapLookupInProgress, setMapLookupInProgress] = useState(false);
    const [mapLookupOccurrences, setMapLookupOccurrences] = useState<any[]>([]);
    // const [mapLookupCount, setMapLookupCount] = useState<number>(0);
    const [mapLookupOccurrence, setMapLookupOccurrence] = useState<any | undefined>(undefined);
    const [mapLookupItemIdx, setMapLookupItemIdx] = useState<number>(0);
    const popupContainerRef = useRef<HTMLDivElement | null>(null);
    const popupRootRef = useRef<ReactDOM.Root | null>(null);
    const popupRef = useRef<L.Popup | null>(null);

    const controllerSpeciesListRef = useRef<AbortController>(new AbortController());
    const signalSpeciesList = controllerSpeciesListRef.current.signal;
    const mapRef = useRef<L.Map | null>(null);
    const handleMyLocation = useCallback(() => {useMyLocation();}, []);
    const intl: IntlShape = useIntl();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Explore by location', href: 'https://www.ala.org.au/explore-by-location/'},
            {title: 'Explore your area', href: '/'},
        ]);

        // if no latLng provided, try to get location from browser
        if (latLngText && latLngText.trim().length > 0) {
            const parts = latLngText.split(',');
            if (parts.length === 2) {
                const lat = Number(parts[0].trim());
                const lng = Number(parts[1].trim());
                if (!isNaN(lat) && !isNaN(lng)) {
                    setLatLng(new LatLng(lat, lng));
                }
            }
        } else if (!latLng && navigator.geolocation) {
            useMyLocation();
        } else {
            setLatLng(center);
        }

        // override the initial ALL_SPECIES with intl.formatMessage({id: "all.species", defaultMessage: "All Species"})
    }, []);

    useEffect(() => {
        fetchGroups();
        fetchSpeciesList();
        filterSpecies(null);
    }, [group, latLng, radius]);

    // update ref, for use by timeout that otherwise uses the old scope
    useEffect(() => {
        redrawMap();
    }, [occurrenceFq]);

    useEffect(() => {
        setAddressText(latLng?.lat.toFixed(4) + ", " + latLng?.lng.toFixed(4));
        zoomToLocation();
        redrawMap();
        setLatLngText(latLng ? `${latLng.lat},${latLng.lng}` : '');
    }, [latLng, radius]);

    useEffect(() => {
        if (!mapRef.current) return;

        // Remove previous control if any
        let existing = document.getElementById("my-location-btn");
        if (existing) existing.remove();

        const MyLocationControl = L.Control.extend({
            onAdd: function () {
                const btn = L.DomUtil.create("button", "leaflet-bar");
                btn.id = "my-location-btn";
                btn.title = "Use my location";
                btn.innerHTML = document.getElementById("fa-location-arrow-item")?.innerHTML || "?";
                btn.style.width = "34px";
                btn.style.height = "34px";
                btn.style.fontSize = "20px";
                btn.onclick = (e) => {
                    e.preventDefault();
                    handleMyLocation();
                };
                return btn;
            },
            onRemove: function () {
            }
        });

        const control = new MyLocationControl({position: "topleft"});
        control.addTo(mapRef.current);

        // Cleanup
        return () => {
            mapRef.current?.removeControl(control);
        };
    }, [mapRef.current, handleMyLocation]);

    // Render popup content when mapLookupOccurrence changes
    useEffect(() => {
        if (!mapLookupOccurrence || !mapRef.current || !mapLookupLatLng) return;

        if (!popupRootRef.current) {
            const container = document.createElement("div");
            popupContainerRef.current = container;
            popupRef.current = L.popup({
                maxWidth: 300,
                minWidth: 300,
                autoPan: true // This is not working as expected, sometimes it does not pan
            }).setLatLng(mapLookupLatLng).setContent(container).openOn(mapRef.current);
            popupRootRef.current = ReactDOM.createRoot(container);
        }

        // update popup
        popupRootRef.current.render(popupDiv());

        // attempt to move into view
        if (mapRef.current && popupRef.current) {
            // I close and re-open the popup to force it to resize and pan the map so that it is fully visible
            mapRef.current.closePopup(popupRef.current);
            popupRef.current.openOn(mapRef.current);
        }
    }, [mapLookupOccurrence]);

    useEffect(() => {
        if (mapLookupOccurrences && mapLookupOccurrences.length > 0) {
            fetchOccurrence(0);
        }
    }, [mapLookupOccurrences]);

    function useMyLocation() {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatLng(new LatLng(position.coords.latitude, position.coords.longitude));
            }, () => {
                // On error, use the default
                setLatLng(center);
            }
        );
    }

    // update current state when a new species is selected
    function filterSpecies(species: any) {
        let newSpecies = (species?.guid === selectedSpecies) ? null : species;

        if (newSpecies) {
            setOccurrenceFq(`&fq=${encodeURIComponent(`lsid:\"${newSpecies.guid}\"`)}`);
        } else if (group && group !== ALL_SPECIES) {
            setOccurrenceFq(`&fq=${encodeURIComponent(`speciesGroup:\"${group}\"`)}`);
        } else {
            setOccurrenceFq('');
        }

        setSelectedSpecies(newSpecies?.guid);
    }

    // update current state when a new species group is selected
    async function fetchGroups() {
        if (!latLng) {
            return;
        }

        // initialize the species groups with only those with data
        const url2 = `${import.meta.env.VITE_APP_BIOCACHE_URL}/explore/groups?${globalFq}&lon=${latLng?.lng}&lat=${latLng?.lat}&radius=${radius}`;
        const response2 = await fetch(url2);
        const data2 = await response2.json();
        const counts: SpeciesGroupFacet = {};
        for (const item of data2) {
            counts[item.name] = item; // .count, .name, .level, .speciesCount
            if (item.name === "ALL_SPECIES") {
                counts[ALL_SPECIES] = item;
            }
        }

        setSpeciesGroupFacet(counts);
        return;
    }

    // zoom to the extents of the region
    function zoomToExtents(extents: [[number, number], [number, number]]) {
        if (!mapRef.current) {
            setTimeout(() => {
                zoomToExtents(extents);
            }, 50);
            return;
        }

        mapRef.current.fitBounds(extents);
    }

    function redrawMap() {
        // must be a better way to do this (e.g. instead of toggle off and on)
        setShowOccurrences(false);
        setTimeout(() => {
            setShowOccurrences(true);
        }, 5);
    }

    // build the WMS URL for the current state
    function getAlaWmsUrl() {
        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=*:*&ENV=color%3AC44D34%3Bname%3Acircle%3Bsize%3A5%3Bopacity%3A0.7&OUTLINE=false${occurrenceFq}${globalFq}&lon=${latLng?.lng}&lat=${latLng?.lat}&radius=${radius}`;
    }

    // get the list of species for the current state
    function fetchSpeciesList() {
        if (!latLng) {
            return;
        }

        setIsFetchingSpeciesList(true); // show spinner
        setSpeciesList(undefined); // show empty list

        // query biocache-service
        const groupParam = group === ALL_SPECIES ? 'ALL_SPECIES' : encodeURIComponent(group);
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/explore/group/${groupParam}?includeRank=false&sort=count&pageSize=-1${globalFq}&lon=${latLng?.lng}&lat=${latLng?.lat}&radius=${radius}`;
        fetch(url, {signal: signalSpeciesList})
            .then((response) => response.json())
            .then((data) => {
                if (data) {
                    setSpeciesList(data);
                } else {
                    // indicate no data is available (replace nulls with empty values)
                    setSpeciesList([]);
                }
                // indicate that loading is finished
                setIsFetchingSpeciesList(false);
            })
            .catch((error) => {
                // cleanly handle error
                if (error.name !== 'AbortError') {
                    setSpeciesList([]);
                }
                setIsFetchingSpeciesList(false);
            });
    }

    function zoomToLocation() {
        if (latLng && radius) {
            // Approximate bounding box in degrees (1 deg ≈ 111 km)
            const delta = radius / 100.0;
            const bounds: [[number, number], [number, number]] = [
                [latLng.lat - delta, latLng.lng - delta],
                [latLng.lat + delta, latLng.lng + delta]
            ];
            zoomToExtents(bounds);
        }
    }

    async function locationSearch() {
        if (locationText.trim().length === 0) {
            return;
        }

        // do a search using google geocoding API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationText)}&key=${import.meta.env.VITE_GOOGLE_MAP_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;
            setLatLng(new LatLng(location.lat, location.lng));
            setAddressText(result.formatted_address);
        } else {
            alert('Location not found, please try again.');
        }
    }

    // Downloading URL for the download UI page. Ignores any species selection and downloads all species in the area for the selected group.
    function getDownloadLink() {
        const searchParams = `?q=speciesGroup:${group == ALL_SPECIES ? '*' : group}&lat=${latLng?.lat}&lon=${latLng?.lng}&radius=${radius}${globalFq}`;
        {/*TODO: convert to navigate*/}
        return `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/download?searchParams=${encodeURIComponent(searchParams)}&targetUri=/explore/your-area`;
    }

    function speciesSortComparator(a: SpeciesListItem, b: SpeciesListItem): number {
        switch (speciesSort) {
            case 'commonName':
                if (!a.commonName && !b.commonName) return 0;
                if (!a.commonName) return 1;
                if (!b.commonName) return -1;
                return a.commonName.localeCompare(b.commonName);
            case 'scientificName':
                return a.name.localeCompare(b.name);
            case 'records':
            default:
                return b.count - a.count;
        }
    }

    function nextOccurrence() {
        setMapLookupItemIdx(mapLookupItemIdx + 1);
        fetchOccurrence(mapLookupItemIdx + 1);
    }

    function prevOccurrence() {
        setMapLookupItemIdx(mapLookupItemIdx - 1);
        fetchOccurrence(mapLookupItemIdx - 1);
    }

    function popupDiv() {
        if (!mapLookupLatLng) {
            return <div style={{width: "300px", height: "250px"}}>{intl.formatMessage({id:"facets.multiplefacets.tabletr01td01", defaultMessage:"loading..."})}</div>;
        }

        const viewing = intl.formatMessage({id: 'search.map.viewing', defaultMessage: 'Viewing'});
        const of = intl.formatMessage({id: 'search.map.of', defaultMessage: 'of'});
        const viewAll = intl.formatMessage({id: 'search.map.viewAllRecords', defaultMessage: 'view all records'});
        const occurrences = intl.formatMessage({id: 'search.map.occurrences', defaultMessage: 'occurrences'});
        const prev = intl.formatMessage({id: 'search.map.popup.prev', defaultMessage: '&lt; Prev'});
        const next = intl.formatMessage({id: 'search.map.popup.next', defaultMessage: 'Next &gt;'});
        const viewRecord = intl.formatMessage({id: 'search.map.popup.viewRecord', defaultMessage: 'View record'});

        // record labels
        const catalogNumberLabel = intl.formatMessage({id: 'record.catalogNumber.label'});
        const recordNumberLabel = intl.formatMessage({id: 'record.recordNumber.label'});
        const recordFieldNumberLabel = intl.formatMessage({id: 'record.fieldNumber.label'});
        const recordInstitutionNameLabel = intl.formatMessage({id: 'record.institutionName.label'});
        const recordDataResourceNameLabel = intl.formatMessage({id: 'record.dataResourceName.label'});
        const recordCollectionNameLabel = intl.formatMessage({id: 'record.collectionName.label'});
        const recordRecordedByLabel = intl.formatMessage({id: 'record.recordedBy.label'});
        const recordEventDateLabel = intl.formatMessage({id: 'record.eventDate.label'});
        const loading = intl.formatMessage({id: "facets.multiplefacets.tabletr01td01", defaultMessage:"loading..."});

        return (
            <div style={{ width: '300px', wordBreak: 'break-word' }}>
                <strong>
                    {viewing} {mapLookupItemIdx + 1} {of} {mapLookupOccurrences.length} {occurrences}
                </strong>
                {/*TODO: convert to navigate*/}
                <a style={{ paddingLeft: '20px', color: '#c44d34' }} href={'/occurrences/search?' + mapLookupQueryParams}>
                    {viewAll}
                </a>
                <br />

                {mapLookupOccurrence?.raw?.occurrence?.catalogNumber && (
                    <>{catalogNumberLabel}: {mapLookupOccurrence.raw.occurrence.catalogNumber}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.catalogNumber && mapLookupOccurrence?.processed?.occurrence?.catalogNumber && (
                    <>{catalogNumberLabel}: {mapLookupOccurrence.processed.occurrence.catalogNumber}<br /></>)}
                {mapLookupOccurrence?.raw?.occurrence?.recordNumber && (
                    <>{recordNumberLabel}: {mapLookupOccurrence.raw.occurrence.recordNumber}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.recordNumber && mapLookupOccurrence?.raw?.occurrence?.fieldNumber && (
                    <>{recordFieldNumberLabel}: {mapLookupOccurrence.raw.occurrence.fieldNumber}<br /></>)}
                {mapLookupOccurrence?.processed?.attribution?.institutionName && (
                    <>{recordInstitutionNameLabel}: {mapLookupOccurrence.processed.attribution.institutionName}<br /></>)}
                {!mapLookupOccurrence?.processed?.attribution?.institutionName && mapLookupOccurrence?.processed?.attribution?.dataResourceName && (
                    <>{recordDataResourceNameLabel}: {mapLookupOccurrence.processed.attribution.dataResourceName}<br /></>)}
                {mapLookupOccurrence?.processed?.attribution?.collectionName && (
                    <>{recordCollectionNameLabel}: {mapLookupOccurrence.processed.attribution.collectionName}<br /></>)}
                {mapLookupOccurrence?.raw?.classification?.vernacularName && (
                    <>{mapLookupOccurrence.raw.classification.vernacularName}<br /></>)}
                {!mapLookupOccurrence?.raw?.classification?.vernacularName && mapLookupOccurrence?.processed?.classification?.vernacularName && (
                    <>{mapLookupOccurrence.processed.classification.vernacularName}<br /></>)}
                {mapLookupOccurrence?.processed?.classification?.scientificName && (
                    <>{mapLookupOccurrence?.processed?.classification?.taxonRankID && mapLookupOccurrence?.processed?.classification?.taxonRankID >= 6000 ? <i>{mapLookupOccurrence.processed.classification.scientificName}</i> : <>{mapLookupOccurrence.processed.classification.scientificName}</>}<br /></>)}
                {!mapLookupOccurrence?.processed?.classification?.scientificName && mapLookupOccurrence?.raw?.classification?.scientificName && (
                    <>{mapLookupOccurrence.raw.classification.scientificName}<br /></>)}
                {mapLookupOccurrence?.raw?.occurrence?.recordedBy && (
                    <>{recordRecordedByLabel}: {mapLookupOccurrence.raw.occurrence.recordedBy}<br /></>)}
                {!mapLookupOccurrence?.raw?.occurrence?.recordedBy && mapLookupOccurrence?.processed?.occurrence?.recordedBy && (
                    <>{recordRecordedByLabel}: {mapLookupOccurrence.processed.occurrence.recordedBy}<br /></>)}
                {mapLookupOccurrence?.processed?.event?.eventDate && (
                    <>{recordEventDateLabel}: {mapLookupOccurrence.processed.event.eventDate}<br /></>)}

                <br />
                {mapLookupOccurrence == undefined && <>{loading}</>}
                <div className={'d-flex'}>
                    <a className='btn btn-sm btn-default'
                        style={{
                            fontSize: '12px',
                            lineHeight: '14px',
                            paddingTop: '2px',
                            textDecoration: 'none',
                            color: '#000'
                        }}
                       href={'/occurrence/' + mapLookupOccurrence?.processed?.uuid}>
                        {viewRecord}
                    </a>
                    <button className='btn btn-sm btn-default ms-auto' style={{ fontSize: '12px', lineHeight: '14px', paddingTop: '2px' }} onClick={mapLookupItemIdx > 0 ? prevOccurrence : undefined} disabled={mapLookupItemIdx === 0 || mapLookupOccurrences.length <= 1}
                        dangerouslySetInnerHTML={{ __html: prev }}>
                    </button>
                    <button
                        className='btn btn-sm btn-default ms-1'
                        style={{ fontSize: '12px', lineHeight: '14px', paddingTop: '2px' }}
                        onClick={mapLookupItemIdx < mapLookupOccurrences.length - 1 ? nextOccurrence : undefined}
                        disabled={mapLookupItemIdx === mapLookupOccurrences.length - 1 || mapLookupOccurrences.length <= 1}
                        dangerouslySetInnerHTML={{ __html: next }}>
                    </button>
                </div>
            </div>
        );
    }

    // this is reusable by the occurrenceList, but for now just keep it here
    function mapClick(e: LeafletMouseEvent) {
        setMapLookupInProgress(true);
        if (popupRef.current) {
            mapRef.current?.closePopup(popupRef.current);
            popupRef.current = null;
            if (popupRootRef.current) popupRootRef.current = null;
        }

        let pointSize = 5;
        let zoomLevel = mapRef.current ? mapRef.current.getZoom() : defaultZoom;
        let c = 400; // base difference circumference in meters
        var radius = c / Math.pow(2, zoomLevel);

        // Adjust radius based on size, legacy calculation
        if (pointSize >= 5 && pointSize < 8) {
            radius *= 2;
        }
        if (pointSize >= 8) {
            radius *= 3;
        }

        // biocache query for this location
        setMapLookupQueryParams(`&lon=${e.latlng.lng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`);
        setMapLookupLatLng(e.latlng);
        setMapLookupOccurrence(undefined);
        setMapLookupItemIdx(0);
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/info?${globalFq}${occurrenceFq}&lon=${e.latlng.lng}&lat=${e.latlng.lat}&radius=${radius}&zoom=${zoomLevel}`;
        fetch(url, {
            method: 'GET'
        }).then(response => response.json()).then((data) => {

            //setMapLookupCount(data.count);
            setMapLookupOccurrences(data.occurrences);

            if (!mapRef.current) {
                return;
            }

            if (data.count == 0) {
                return;
            }
        }).finally(() => {
            setMapLookupInProgress(false);
        })
    }

    function fetchOccurrence(idx: number) {
        if (mapLookupOccurrences.length > idx) {
            const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrence/${mapLookupOccurrences[idx]}`;
            fetch(url, {
                method: 'GET'
            }).then(response => response.json()).then((data) => {
                setMapLookupOccurrence(data);
            });
        }
    }

    return <>
        <div id="main" className="container-fluid">
            {/*Hidden icons for map controls, copying the innerHTML for now*/}
            <div style={{display: 'none'}} id="fa-location-arrow-item">
                <FontAwesomeIconLite icon={faLocationArrow} style={{height: '16px'}}/></div>

            <div className="container-fluid">
                <div id="headingBar" className="mt-5">
                    <h1 className="w-100" id="searchHeader" style={{fontSize: '36px'}}>
                        <FormattedMessage id="eya.header.title" defaultMessage="Explore Your Area"/>
                    </h1>
                    <div style={{fontSize: '18px', fontWeight: '500'}} className="mt-3">
                        <FormattedMessage id="eya.searchform.label01" defaultMessage="Enter your location or address"/>
                    </div>

                    <div className="input-group mt-2" style={{maxWidth: '700px'}}>
                        <input value={locationText} onChange={(e) => setLocationText(e.target.value)} type="text" className="form-control"
                               placeholder={intl.formatMessage({id:'eya.searchform.des01', defaultMessage:"E.g. a street address, place name, postcode or GPS coordinates (as lat, long)"})}/>
                        <button className="btn btn-primary" onClick={() => locationSearch()}>
                            <FormattedMessage id="eya.searchform.btn01" defaultMessage="Search"/>
                        </button>
                    </div>
                </div>
                <hr/>
                <div className="container-fluid">
                    <div className="mb-3 row">
                        <div className="col-sm-12 col-md-12 mt-2">
                            <FormattedMessage id="eya.searchform.label02" defaultMessage="Showing records for"/>: <b>{addressText}</b>
                        </div>
                        <div className="col-sm-12 col-md-12 mt-2">
                            <FormattedMessage id="eya.searchformradius.label01" defaultMessage="Display records in a"/>
                            &nbsp;<select value={radius} onChange={e => setRadius(Number(e.target.value))} style={{width: '40px', display: 'inline-block'}}>
                            <option value={1}>1</option>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                        </select>&nbsp;<FormattedMessage id="eya.searchformradius.label02" defaultMessage="km radius"/>
                        </div>
                    </div>
                </div>
                <div className="container-fluid">
                    <div className="mb-3 row">
                        <div className="col-md-7 pe-3 col-sm-12">
                            <div className={'d-flex'}>
                                <table className={'table'} style={{width: '33%', height: 'fit-content'}}>
                                    <thead>
                                    <tr>
                                        <th><FormattedMessage id="eya.table.01.th01" defaultMessage="Group"/></th>
                                        <th style={{textAlign: 'right', paddingRight: '20px'}}><FormattedMessage id="eya.table.01.th02" defaultMessage="Species"/></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {speciesGroupFacet && speciesGroups.map((itemFiltered, idx) => (
                                        <tr key={idx} style={{padding: '0'}}
                                            className={styles.speciesGroupItem + (itemFiltered.name === group ? ' ' + styles.speciesItemSelected : '')}>
                                            <td onClick={() => isFetchingSpeciesList || setGroup(itemFiltered.name)}
                                                style={{ cursor: isFetchingSpeciesList ? 'wait' : 'pointer', padding: '0', background: 'transparent' }}>
                                                <span
                                                    className={styles.speciesItemParent + ' speciesItem' + (itemFiltered.indent > 0 ? ' ms-' + itemFiltered.indent * 2 : '')}
                                                    style={{backgroundColor: 'transparent'}}>
                                                    {itemFiltered.name}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '0 20px 0 0', background: 'transparent' }}>
                                                {speciesGroupFacet[itemFiltered.name]?.speciesCount}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                <div style={{ width: '64%', height: '500px', overflowY: 'auto', backgroundColor: '#f2f2f2' }}>
                                    <table className={'table'} style={{width: '100%'}}>
                                        <thead style={{}}>
                                        <tr style={{}}>
                                            <th style={{width: "40%", position: 'sticky', top: '0'}} className={styles.speciesTableHeader} onClick={() => setSpeciesSort('commonName')}>
                                                <FormattedMessage id="eya.table.02.th01.a" defaultMessage="Common Name"/>
                                            </th>
                                            <th style={{width: "40%"}} className={styles.speciesTableHeader} onClick={() => setSpeciesSort('scientificName')}>
                                                <FormattedMessage id="eya.table.02.th01" defaultMessage="Scientific Name"/>
                                            </th>
                                            <th style={{textAlign: 'right', width: "20%", position: 'sticky', top: '0'}} className={styles.speciesTableHeader} onClick={() => setSpeciesSort('records')}>
                                                <FormattedMessage id="eya.table.02.th02" defaultMessage="Records"/>
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {!speciesList && (
                                            <tr style={{backgroundColor: 'transparent'}}>
                                                <td style={{backgroundColor: 'transparent'}} colSpan={3}>
                                                    <FontAwesomeIconLite icon={faSpinner}/></td>
                                            </tr>
                                        )}
                                        {speciesList && speciesList.length === 0 && (
                                            <tr style={{backgroundColor: 'transparent'}}>
                                                <td style={{backgroundColor: 'transparent'}} colSpan={3}><p><FormattedMessage id='eya.nospecies' defaultMessage='No species found'/></p></td>
                                            </tr>
                                        )}
                                        {speciesList && speciesList.sort(speciesSortComparator).map((species, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr style={{ backgroundColor: (species.guid === selectedSpecies ? '#fff' : ''), cursor: 'pointer' }}
                                                    className={styles.speciesItemParent + ' ' + (species.guid === selectedSpecies ? ' ' + styles.speciesItemSelected : '')}
                                                    onClick={() => filterSpecies(species)}>
                                                    {/*className={'d-flex justify-content-between ' + styles.speciesItem}>*/}
                                                    <td style={{
                                                        padding: "1px 8px",
                                                        backgroundColor: "transparent",
                                                        width: '40%'
                                                    }}>
                                                        {species.commonName}
                                                    </td>
                                                    <td className={styles.speciesName} style={{
                                                        padding: "1px 8px",
                                                        backgroundColor: "transparent",
                                                        width: '40%'
                                                    }}>
                                                        {species.name}
                                                    </td>
                                                    <td style={{
                                                        textAlign: 'right',
                                                        padding: "1px 8px",
                                                        backgroundColor: "transparent",
                                                        width: '20%'
                                                    }}>
                                                        {species.count}
                                                    </td>
                                                </tr>
                                                {species.guid && species.guid === selectedSpecies && (
                                                    <tr style={{
                                                        backgroundColor: (species.guid === selectedSpecies ? '#fff' : ''),
                                                        cursor: 'pointer'
                                                    }}
                                                        onClick={() => filterSpecies(species.guid)}>
                                                        <td colSpan={3} style={{backgroundColor: "transparent"}}>
                                                            <div className={'d-flex justify-content-end'}>
                                                                <a className="btn btn-default btn-sm ms-3"
                                                                   style={{textDecoration: 'none'}}
                                                                   href={`${import.meta.env.VITE_SPECIES_URL_PREFIX}${species.guid}`}>
                                                                    <FormattedMessage id='eya.speciesprofile' defaultMessage='Species profile'/>
                                                                </a>
                                                                <a className="btn btn-default btn-sm ms-3"
                                                                   style={{textDecoration: 'none'}}
                                                                   // TODO: convert to navigate
                                                                   href={`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:"${encodeURIComponent(species.guid)}"${globalFq}&lon=${latLng?.lng}&lat=${latLng?.lat}&radius=${radius}`}>
                                                                    <FormattedMessage id='eya.listrecords' defaultMessage='List records'/>
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>)
                                        )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="d-flex mt-3 mb-4">
                                <a className={`btn btn-sm btn-default ${!speciesList || speciesList.length === 0 ? ' disabled' : ''}`}
                                   style={{
                                       textDecoration: 'none',
                                       pointerEvents: (!speciesList || speciesList.length === 0) ? 'none' : 'auto',
                                       opacity: (!speciesList || speciesList.length === 0) ? 0.5 : 1
                                   }}
                                   // TODO: convert to navigate
                                   href={`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?${occurrenceFq}${globalFq}&lon=${latLng?.lng}&lat=${latLng?.lat}&radius=${radius}`}
                                   tabIndex={(!speciesList || speciesList.length === 0) ? -1 : 0}
                                   aria-disabled={!speciesList || speciesList.length === 0}>
                                    <FormattedMessage id='eya.searchform.viewrecordsfor' defaultMessage='View records for'/> {group}
                                </a>
                                <a className={`btn btn-sm btn-default ms-3${!speciesList || speciesList.length === 0 ? ' disabled' : ''}`}
                                   style={{
                                       textDecoration: 'none',
                                       pointerEvents: (!speciesList || speciesList.length === 0) ? 'none' : 'auto',
                                       opacity: (!speciesList || speciesList.length === 0) ? 0.5 : 1
                                   }}
                                   href={speciesList && speciesList.length > 0 ? getDownloadLink() : undefined}
                                   tabIndex={(!speciesList || speciesList.length === 0) ? -1 : 0}
                                   aria-disabled={!speciesList || speciesList.length === 0}>
                                    <FormattedMessage id='eya.searchform.downloadrecordsfor' defaultMessage='Download records for'/> {group}
                                </a>
                            </div>
                        </div>

                        <div className="col-md-5 col-sm-12" style={{position: 'relative'}}>
                            {mapLookupInProgress && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    zIndex: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FontAwesomeIconLite icon={faSpinner} spin style={{fontSize: 64, color: '#999'}}/>
                                </div>
                            )}
                            <div id="leafletMap" style={{height: "500px", position: "relative"}}>
                                <MapContainer
                                    ref={mapRef}
                                    center={center}
                                    zoom={defaultZoom}
                                    scrollWheelZoom={false}
                                    worldCopyJump={true}
                                    style={{
                                        height: '500px',
                                        borderRadius: '10px',
                                    }}
                                >
                                    {!import.meta.env.VITE_GOOGLE_MAP_API_KEY &&
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL}
                                            zIndex={1}
                                        />
                                    }
                                    {import.meta.env.VITE_GOOGLE_MAP_API_KEY && (
                                        <LayersControl position="topright">
                                            <LayersControl.BaseLayer checked name="Minimal">
                                                <TileLayer
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL}
                                                    zIndex={1}
                                                />
                                            </LayersControl.BaseLayer>
                                            <LayersControl.BaseLayer name="Road">
                                                <ReactLeafletGoogleLayer
                                                    apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                    type={'roadmap'}
                                                />
                                            </LayersControl.BaseLayer>
                                            <LayersControl.BaseLayer name="Terrain">
                                                <ReactLeafletGoogleLayer
                                                    apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                    type={'terrain'}
                                                />
                                            </LayersControl.BaseLayer>
                                            <LayersControl.BaseLayer name="Satellite">
                                                <ReactLeafletGoogleLayer
                                                    apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY}
                                                    type={'satellite'}
                                                />
                                            </LayersControl.BaseLayer>
                                        </LayersControl>
                                    )}
                                    {latLng && (<>
                                        <Marker
                                            position={latLng}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const marker = e.target;
                                                    const position = marker.getLatLng();
                                                    setLatLng(position);
                                                },
                                            }}
                                        />
                                        <Circle
                                            center={latLng}
                                            radius={radius * 1000} // km to meters
                                            pathOptions={{color: '#C44D34', fillOpacity: 0.2}}
                                            eventHandlers={{ click: (e) => {mapClick(e)} }}
                                        />
                                    </>)}

                                    {showOccurrences &&
                                        occurrenceFq !== undefined && (
                                            <WMSTileLayer
                                                url={getAlaWmsUrl()}
                                                layers="ALA:occurrences"
                                                format="image/png"
                                                transparent={true}
                                                opacity={1.0}
                                                attribution="Atlas of Living Australia"
                                                zIndex={15}
                                            />
                                        )}
                                </MapContainer>
                                <strong><FormattedMessage id="eya.maptips.01" defaultMessage="Tip"/></strong>: <FormattedMessage id="eya.maptips.02" defaultMessage="you can fine-tune the location of the area by dragging the blue marker icon"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
}

export default ExploreYourArea;
