/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {LayersControl, MapContainer, TileLayer, WMSTileLayer} from 'react-leaflet';
import FontAwesomeIcon from '../components/common-ui/fontAwesomeIconLite.tsx'
import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {formatNumber} from "../components/util/FormatNumber.tsx"
import styles from './region.module.css';
import speciesGroupMapImport from "../config/speciesGroupsMap.json";
import {Container, OverlayTrigger, Tab, Tabs, Tooltip} from "react-bootstrap";
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner'
import {faInfoCircle} from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import {Pie} from "react-chartjs-2";
import {Chart, ArcElement, BarElement, Legend, Tooltip as ChartTooltip} from 'chart.js'
import DualRangeSlider from "../components/common-ui/dualRangeSlider.tsx";
import ReactLeafletGoogleLayer from "react-leaflet-google-layer";
import useHashState from "../components/util/useHashState.tsx";

Chart.register(ArcElement, BarElement, Legend, ChartTooltip);

// defaults
const center = new LatLng(Number(import.meta.env.VITE_MAP_CENTRE_LAT), Number(import.meta.env.VITE_MAP_CENTRE_LNG));
const OBJECT_OPACITY = 50; // 0 to 100
const OCCURRENCE_OPACITY = 100; // 0 to 100
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);
const globalFq = import.meta.env.VITE_GLOBAL_FQ;
const EARLIEST_YEAR = Number(import.meta.env.VITE_EARLIEST_YEAR);
const INTERVAL_MILLISECONDS = Number(import.meta.env.VITE_PLAYER_INTERVAL_MILLISECONDS);
const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const customColors = [
    '#003A70', '#F26649', '#6BDAD5', '#EB9D07', '#A191B2', '#FFC557', '#D9D9D9'
];

// default species group import. I think this should be moved to the buildSpeciesGroupConfig.js
const ALL_SPECIES = "All Species";
const speciesGroups: SpeciesGroupItem[] = [
    {
        name: ALL_SPECIES,
        indent: 0
    }
];
const insertFlatSpeciesGroups = (group: SpeciesGroup[], indent: number = 0): void => {
    group.forEach(thisGroup => {
        speciesGroups.push({
            name: thisGroup.name,
            indent: indent
        })
        if (thisGroup.children) {
            insertFlatSpeciesGroups(thisGroup.children, indent + 1);
        }
    });
};
insertFlatSpeciesGroups(Object.values(speciesGroupMapImport), 1);

// information about the spatial object that defines the region used on the page
interface SpatialObject {
    pid: string,
    fid: string,
    name: string,
    bbox: string,
    description: string,
    centroid: [number, number]
}

// used by the species group import
interface SpeciesGroup {
    name: string,
    children?: SpeciesGroup[]
}

// used for the left hand side section for the listing of species groups
interface SpeciesGroupItem {
    name: string,
    indent: number
}

// used for the right hand side section for the listing of species
interface SpeciesListItem {
    label: string,
    count: number
}

// used for the chart data
interface ChartData {
    labels: string[];
    datasets?: {
        data: number[];
        borderWidth: number;
    }[];
}

/**
 * Region page. Shows a single region and allows exploration of species and taxonomy.
 * Based on the existing regions app.
 *
 * Query parameters:
 * - id: the region id
 *
 * The hash in the URL is used for:
 * - species: selected species
 * - group: selected species group
 * - tab: selected tab
 * - from: year range start
 * - to: year range end
 *
 * @param setBreadcrumbs
 * @constructor
 */
function Region({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}) {
    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [speciesCount, setSpeciesCount] = useState(-1);
    const [showOccurrences, setShowOccurrences] = useState(true);
    const [showObject, setShowObject] = useState(true);
    const [objectOpacity, setObjectOpacity] = useState(OBJECT_OPACITY);
    const [occurrenceOpacity, setOccurrenceOpacity] = useState(OCCURRENCE_OPACITY);
    const [object, setObject] = useState<SpatialObject | undefined>(undefined);
    const [occurrenceFq, setOccurrenceFq] = useState('');
    const [speciesGroupFacet, setSpeciesGroupFacet] = useState<{ [key: string]: number }>({});
    const [speciesList, setSpeciesList] = useState<SpeciesListItem[] | undefined>(undefined);
    const [playerState, setPlayerState] = useState<string>('stopped'); // 'stopped', 'playing', 'paused'
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
    const [isFetchingSpeciesList, setIsFetchingSpeciesList] = useState(false);
    const [selectedSpecies, setSelectedSpecies] = useHashState<string | null>('species', null);
    const [group, setGroup] = useHashState<string>('group', ALL_SPECIES);
    const [chartData, setChartData] = useState<ChartData | undefined>(undefined);
    const [rankFqs, setRankFqs] = useState<string[]>([]);
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [currentRank, setCurrentRank] = useState<number>(0);
    const [yearMin, setYearMin] = useHashState<number>('from', EARLIEST_YEAR);
    const [yearMax, setYearMax] = useHashState<number>('to', new Date().getFullYear());
    const [tab, setTab] = useHashState<string>('tab', 'species');

    // needed for the player to work
    const playerStateRef = useRef(playerState);
    const controllerSpeciesListRef = useRef<AbortController>(new AbortController());
    const mapRef = useRef<L.Map | null>(null);

    // I don't remember why playerState needs a wrapper playerStateRef
    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);

    // init
    useEffect(() => {
        // get the id from the query string and fetch the spatial object's information
        const queryString = location.search;
        const searchParams = new URLSearchParams(queryString);
        const id = searchParams.get('id');
        if (id) {
            fetchObject(id);
        }
    }, []);

    // return the dateFq string using the current year range
    function dateFq(newYearRange?: [number, number]) {
        let currentYearRange = newYearRange || [yearMin, yearMax];
        let startYear = currentYearRange ? currentYearRange[0] : EARLIEST_YEAR;
        let endYear = currentYearRange ? currentYearRange[1] : new Date().getFullYear;
        let value = `occurrenceYear:[${startYear}-01-01T00:00:00Z TO ${endYear}-12-31T23:59:59Z]`
        return "&fq=" + encodeURIComponent(value);
    }

    // pie chart component
    const PieChart = (data: any) => {
        const options = {
            plugins: {
                tooltip: {
                    titleFont: {
                        size: 12
                    },
                    bodyFont: {
                        size: 12
                    },
                },
                legend: {
                    display: true,
                    responsive: true,
                    position: 'right' as const,
                    labels: {
                        boxWidth: 36,
                        padding: 5,
                        font: {
                            size: 12
                        },
                    },
                    align: 'center' as const,
                    title: {
                        display: true,
                        text: ranks[currentRank].charAt(0).toUpperCase() + ranks[currentRank].slice(1)
                    }
                }
            },
            maintainAspectRatio: false,
            // @ts-ignore
            onClick(event: any, elements: any) {
                if (elements.length === 1 && chartData) {
                    const selected = chartData.labels[elements[0].index];
                    const fq: string = `&fq=${ranks[currentRank]}:\"${encodeURIComponent(selected)}\"`;

                    // drill down into the chart for the given rank and taxon name
                    if (!rankFqs.includes(fq)) {
                        let newRankFqs = [...rankFqs, fq];
                        setRankFqs(newRankFqs);
                        setSelectedRanks([...selectedRanks, selected]);

                        // use the current fq
                        setOccurrenceFq(newRankFqs.join(''));

                        redrawMap();

                        let newRank = currentRank + 1;
                        if (newRank < ranks.length && object) {
                            setCurrentRank(newRank);
                            fetchChartData(object.fid, object.name, newRank, newRankFqs.join(''));
                            fetchSpeciesList(object.fid, object.name, newRankFqs.join('')); // updates the page occurrence and species count
                        }
                    }
                }
            }
        };

        // add colours to data
        data.datasets[0].backgroundColor = customColors;
        data.datasets[0].borderColor = customColors;
        data.datasets[0].borderWidth = 1;

        return <Pie data={data}
                    height={350}
                    width={350}
                    options={options}/>;
    }

    // get the spatial object and initialize the list of species groups to only those that have records
    const fetchObject = async (id: string) => {
        const url = `${import.meta.env.VITE_SPATIAL_URL}/ws/object/${id}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.bbox) {
            let points = data.bbox.replace("POLYGON((", "").replace("))", "").split(",");
            let centroid: [number, number] = [(parseFloat(points[0].split(" ")[1]) + parseFloat(points[2].split(" ")[1])) / 2, (parseFloat(points[0].split(" ")[0]) + parseFloat(points[2].split(" ")[0])) / 2];

            // zoom to extents, + a buffer of 10%
            let extents: [[number, number], [number, number]] = [[parseFloat(points[0].split(" ")[1]), parseFloat(points[0].split(" ")[0])], [parseFloat(points[2].split(" ")[1]), parseFloat(points[2].split(" ")[0])]]
            extents = [[extents[0][0] - (extents[1][0] - extents[0][0]) * 0.1, extents[0][1] - (extents[1][1] - extents[0][1]) * 0.1], [extents[1][0] + (extents[1][0] - extents[0][0]) * 0.1, extents[1][1] + (extents[1][1] - extents[0][1]) * 0.1]];
            zoomToExtents(extents);

            setObject({
                pid: id,
                fid: data.fid,
                name: data.name,
                bbox: data.bbox,
                description: data.description,
                centroid: centroid
            });

            // set the breadcrumbs now that we have the region name
            setBreadcrumbs([
                {title: 'Home', href: import.meta.env.VITE_HOME_URL},
                {title: "Explore", href: import.meta.env.VITE_EXPLORE_URL},
                {title: 'Regions', href: '/'},
                {title: data.name, href: ''}
            ]);

            // initialize the species groups with only those with data
            const url2 = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${data.fid}:\"${encodeURIComponent(data.name)}\"&facets=speciesGroup&pageSize=0&flimit=-1${globalFq}`;
            const response2 = await fetch(url2);
            const data2 = await response2.json();
            if (data2.facetResults && data2.facetResults[0]) {
                const counts: { [key: string]: number } = {}
                for (const item of data2.facetResults[0].fieldResult) {
                    counts[item.label] = item.count;
                }
                setSpeciesGroupFacet(counts);
                setOccurrenceCount(data2.totalRecords);

                // set initial fq
                const newOccurrenceFq = group !== ALL_SPECIES ? `&fq=${encodeURIComponent(`speciesGroup:\"${group}\"`)}` : '';
                setOccurrenceFq(newOccurrenceFq);

                // get the initial list of species and chart data
                fetchSpeciesList(data.fid, data.name, newOccurrenceFq);
                fetchChartData(data.fid, data.name);
            } else {
                // indicate that loading is finished and no data is available (replace nulls with empty values)
                setSpeciesGroupFacet({});
                setOccurrenceCount(0);
                setSpeciesCount(0);
                setSpeciesList([]);
                setChartData({labels: []});
            }
        }
    }

    // get the list of species for the current state
    function fetchSpeciesList(fid: string, name: string, fq: string, currentYearRange?: [number, number]) {
        setIsFetchingSpeciesList(true); // show spinner
        setSpeciesList(undefined); // show empty list

        // Reset the AbortController if it exists
        if (controllerSpeciesListRef.current) {
            controllerSpeciesListRef.current.abort();
        }
        controllerSpeciesListRef.current = new AbortController();
        const signalSpeciesList = controllerSpeciesListRef.current.signal;

        // query biocache-service
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${fid}:\"${encodeURIComponent(name)}\"${fq}&pageSize=0&flimit=-1&facets=species${globalFq}${dateFq(currentYearRange)}`;
        fetch(url, {signal: signalSpeciesList})
            .then(response => response.json())
            .then(data => {
                if (data.facetResults && data.facetResults[0]) {
                    setOccurrenceCount(data.totalRecords);
                    setSpeciesCount(data.facetResults[0].fieldResult.length);
                    setSpeciesList(data.facetResults[0].fieldResult);
                } else {
                    // indicate no data is available (replace nulls with empty values)
                    setOccurrenceCount(0);
                    setSpeciesCount(0);
                    setSpeciesList([]);
                }
                // indicate that loading is finished
                setIsFetchingSpeciesList(false);

                // if the player is running, continue playing (does not wait for WMS to load)
                if (playerStateRef.current === 'playing') {
                    playLoop(currentYearRange || [yearMin, yearMax]);
                }
            }).catch((error) => {
            // cleanly handle error
            if (error.name !== 'AbortError') {
                setOccurrenceCount(0);
                setSpeciesCount(0);
                setSpeciesList([]);

                if (playerStateRef.current === 'playing') {
                    playerStop();
                }
            }
            setIsFetchingSpeciesList(false);
        });
    }

    // get the chart data for the current state
    function fetchChartData(fid: string, name: string, newRank?: number, newOccurrenceFq?: string, currentYearRange?: [number, number]) {
        setChartData(undefined); // clear the chart

        // build the biocache-service query
        const rank = newRank !== undefined ? newRank : currentRank;
        const fq = newOccurrenceFq !== undefined ? newOccurrenceFq : occurrenceFq;
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${fid}:\"${encodeURIComponent(name)}\"${fq}${globalFq}${dateFq(currentYearRange)}&pageSize=0&flimit=-1&facets=${ranks[rank]}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.facetResults && data.facetResults[0]) {
                    const counts = []
                    const labels = [];
                    for (const item of data.facetResults[0].fieldResult) {
                        counts.push(item.count);
                        labels.push(item.label);
                    }

                    let chart: ChartData = {
                        labels: labels,
                        datasets: [
                            {
                                data: counts,
                                borderWidth: 1,
                            },
                        ],
                    };

                    setChartData(chart);
                } else {
                    // indicate no data is available (replace nulls with empty values)
                    setChartData({labels: []});
                }
            });

        return "chart data";
    }

    // build the WMS URL for the current state
    function getAlaWmsUrl() {
        if (!object) {
            return '';
        }

        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=${object.fid}:\"${encodeURIComponent(object.name)}\"&ENV=color%3AC44D34%3Bname%3Acircle%3Bsize%3A3%3Bopacity%3A0.7&OUTLINE=false${occurrenceFq}${globalFq}${dateFq()}`;
    }

    // update current state when a new species group is selected
    function filter(newGroup: any) {
        if (!object) {
            return;
        }

        if (newGroup.name === group) {
            return;
        }

        setGroup(newGroup.name); // select the new group
        setSelectedSpecies(null); // unselect any selected species

        // construct the new fq
        const newFq = newGroup.name !== ALL_SPECIES ? `&fq=${encodeURIComponent(`speciesGroup:\"${newGroup.name}\"`)}` : '';

        // set and use the new fq
        setOccurrenceFq(newFq);
        fetchSpeciesList(object.fid, object.name, newFq);
        redrawMap();
    }

    // update current state when a new species is selected
    function filterSpecies(species: any) {
        if (group && group !== ALL_SPECIES) {
            setOccurrenceFq(`&fq=${encodeURIComponent(`speciesGroup:\"${group}\"`)}&fq=${encodeURIComponent(`species:\"${species.label}\"`)}`);
        } else {
            setOccurrenceFq(`&fq=${encodeURIComponent(`species:\"${species.label}\"`)}`);
        }

        redrawMap();
        setSelectedSpecies(species.label);
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

    // open the download link for the current state
    function openDownloadLink() {
        if (!object) {
            return;
        }

        // build the biocache-hub URL that opens the biocache-hub's download page
        const q = `${object.fid}:"${object.name}"`
        const params = `?q=${encodeURIComponent(q)}${occurrenceFq}${globalFq}${dateFq()}`;
        const searchParams = encodeURIComponent(params); // encode the whole query
        const url = `${import.meta.env.VITE_DOWNLOAD_URL}${searchParams}`;
        window.open(url, '_blank');
    }

    // open the biocache-hub search results page for the current species (or null), including the current state (date range filter, global fq)
    function openBiocacheForSpecies(species: any) {
        if (!object) {
            return;
        }

        const speciesFq = species ? `&fq=species:\"${encodeURIComponent(species.label)}\"` : '';
        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${speciesFq}${occurrenceFq}${globalFq}${dateFq()}`;
        window.open(url, '_blank');
    }

    // update the current state of the map, chart and/or species list when the year range change is finalised
    function yearRangeEnd(minVal: number, maxVal: number) {
        if (!object) {
            return;
        }

        // convert new values to years
        const thisMinVal = Math.floor(minVal);
        const thisMaxVal = Math.floor(maxVal);

        const newYearRange: [number, number] = [thisMinVal, thisMaxVal];

        fetchSpeciesList(object.fid, object.name, occurrenceFq, newYearRange);
        fetchChartData(object.fid, object.name, currentRank, occurrenceFq, newYearRange);
        redrawMap();

        // species selection is cleared when the year range changes, so set it to null and reset the occurrenceFq
        if (selectedSpecies) {
            if (group && group !== ALL_SPECIES) {
                setOccurrenceFq(`&fq=speciesGroup:\"${encodeURIComponent(group)}\"`);
            }
            setSelectedSpecies(null);
        }
    }

    function redrawMap() {
        // must be a better way to do this (e.g. instead of toggle off and on)
        setShowOccurrences(false);
        setTimeout(() => {
            setShowOccurrences(true);
        }, 5);
    }

    // start playing the year range player
    function playerPlay() {
        if (!object) {
            return;
        }

        setPlayerState('playing');
        let currentYearRange: [number, number] = [yearMin, yearMax];
        if (playerStateRef.current == 'stopped') {
            // reset the year range
            currentYearRange = [EARLIEST_YEAR, Math.min(EARLIEST_YEAR + 10, new Date().getFullYear())];
            setYearMin(currentYearRange[0]);
            setYearMax(currentYearRange[1]);
            redrawMap();

            fetchSpeciesList(object.fid, object.name, occurrenceFq, currentYearRange);
        }

        playLoop(currentYearRange);
    }

    // do the next year range of year range player
    function playLoop(currentYearRange: [number, number]) {
        if (!object) {
            return;
        }

        const id = setTimeout(() => {
            // set initial year range
            let nextYearRange: [number, number] = [currentYearRange[0] + 10, Math.min(currentYearRange[1] + 10, new Date().getFullYear())];
            if (nextYearRange[0] > nextYearRange[1]) {
                playerStop();
            } else {
                setYearMin(nextYearRange[0])
                setYearMax(nextYearRange[1])
                fetchSpeciesList(object.fid, object.name, occurrenceFq, nextYearRange);
                fetchChartData(object.fid, object.name, currentRank, occurrenceFq, nextYearRange);

                redrawMap();
            }
        }, INTERVAL_MILLISECONDS);
        setTimeoutId(id);
    }

    // pause the year range player1
    function playerPause() {
        if (controllerSpeciesListRef.current) {
            controllerSpeciesListRef.current.abort();
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }
        setPlayerState('paused');
    }

    // stop the year range player1
    function playerStop() {
        if (controllerSpeciesListRef.current) {
            controllerSpeciesListRef.current.abort();
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }
        setPlayerState('stopped');
    }

    // reset the year range and stop the player
    function playerReset() {
        if (!object) {
            return;
        }

        playerStop();

        // wait a bit for the player to stop before doing the actual reset
        setTimeout(() => {
            setYearMin(EARLIEST_YEAR);
            setYearMax(new Date().getFullYear());
            fetchSpeciesList(object.fid, object.name, occurrenceFq, [EARLIEST_YEAR, new Date().getFullYear()]);
            fetchChartData(object.fid, object.name, currentRank, occurrenceFq, [EARLIEST_YEAR, new Date().getFullYear()]);
            redrawMap();
        }, 100);
    }

    // open the species page for the selected species
    function openSpeciesPage(species: any) {
        if (!object) {
            return;
        }

        // need the taxonId first, do a biocache query to get it. Namematching service could also be used
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"&fq=species:\"${encodeURIComponent(species.label)}\"${occurrenceFq}${globalFq}${dateFq()}&pageSize=1`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.occurrences && data.occurrences.length > 0) {
                    const taxonId = data.occurrences[0].taxonConceptID;

                    window.open(import.meta.env.VITE_SPECIES_PAGE_URL + `${taxonId}`, '_blank');
                }
            });
    }

    // do the reset required after a tab change
    function tabChanged(key: string | null) {
        if (!key) {
            return;
        }

        if (!object) {
            return;
        }

        setTab(key);

        // reset stuff
        setGroup(ALL_SPECIES);
        setSelectedSpecies(null);
        setOccurrenceFq('');
        setSpeciesList(undefined);
        setChartData(undefined);
        setCurrentRank(0);
        setRankFqs([]);
        setSelectedRanks([]);

        // updates required by value resets
        fetchSpeciesList(object.fid, object.name, '');
        fetchChartData(object.fid, object.name, 0, '');
        redrawMap();
    }

    // drill up the chart, when a button is clicked
    function drillUpChart() {
        if (!object) {
            return;
        }

        let newRank = currentRank - 1;
        if (newRank >= 0) {
            setCurrentRank(newRank);

            // remove the last rank fq
            const newRankFqs = rankFqs.slice(0, rankFqs.length - 1);
            setRankFqs(newRankFqs);
            setSelectedRanks(selectedRanks.slice(0, selectedRanks.length - 1));

            setOccurrenceFq(newRankFqs.join(''));

            fetchChartData(object.fid, object.name, newRank, newRankFqs.join(''));
            fetchSpeciesList(object.fid, object.name, newRankFqs.join('')); // updates the page occurrence and species count

            redrawMap();
        }
    }

    // create an alert for the region and global fq (differs from elsewhere that use the current state)
    function createAlert() {
        if (!object) {
            return;
        }

        // while this produces an alert identical to biocache-hubs, alerts app may need work
        const query = `/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${globalFq}`;
        const url = `${import.meta.env.VITE_APP_ALERTS_URL}/webservice/createBiocacheNewRecordsAlert?webserviceQuery=${query}&uiQuery=${query}&queryDisplayName=${object.name}&baseUrlForWS=${import.meta.env.VITE_APP_BIOCACHE_URL}&baseUrlForUI=${import.meta.env.VITE_APP_BIOCACHE_UI_URL}&resourceName=${import.meta.env.VITE_APP_ALERT_RESOURCE_NAME}`;
        window.open(url, '_blank');
    }

    return (
        <>
            {(occurrenceCount < 0 || speciesCount < 0) &&
                <div className={"d-flex justify-content-center align-items-center " + styles.pageLoading}>
                    <FontAwesomeIcon icon={faSpinner}/>
                </div>}
            {occurrenceCount >= 0 && speciesCount >= 0 &&
                <>
                    {object &&
                        <Container className="mt-5">
                            <div className="d-flex justify-content-between">
                                <h2>{object.name}</h2>
                                <div>
                                    <button className="btn btn-sm btn-primary" onClick={createAlert}>Alerts</button>
                                </div>
                            </div>
                            <h3 className="mt-4">Occurrence records ({formatNumber(occurrenceCount)})</h3>
                            <h3 className="mt-3">Number of species ({formatNumber(speciesCount)})</h3>

                            <div className={styles.regionSections}>
                                <div className={styles.tabPanel}>
                                    <Tabs defaultActiveKey={tab} onSelect={tabChanged}>
                                        <Tab eventKey="species" title="Explore by species">
                                            <div className={styles.regionPanelGroup}>
                                                <div className={"d-flex " + styles.regionHeader}>
                                                    <div
                                                        className={styles.regionPanel + " " + styles.regionLeft}>Group
                                                    </div>
                                                    <div className={styles.regionPanel}>Species</div>
                                                </div>

                                                <div className="d-flex">
                                                    <div className={styles.regionPanel + " " + styles.regionLeft}>
                                                        {speciesGroupFacet && speciesGroups.filter(item => speciesGroupFacet[item.name] || item.name === "All Species").map((itemFiltered, idx) =>
                                                            <div key={idx}
                                                                 onClick={() => isFetchingSpeciesList || filter(itemFiltered)}
                                                                 className={styles.speciesItemParent + " speciesItem" + (itemFiltered.indent > 0 ? " ms-" + itemFiltered.indent * 2 : "") + (itemFiltered.name === group ? " " + styles.speciesItemSelected : "")}
                                                                 style={{cursor: isFetchingSpeciesList ? 'wait' : 'pointer'}}>
                                                                {itemFiltered.name}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className={styles.regionPanel}>
                                                        {!speciesList &&
                                                            <div className="d-flex justify-content-center mt-2">
                                                                <FontAwesomeIcon icon={faSpinner}/>
                                                            </div>}
                                                        {speciesList && speciesList.length === 0 &&
                                                            <p>No species found</p>}
                                                        {speciesList && speciesList.map((species, idx) => (
                                                            <div key={idx}
                                                                 className={styles.speciesItemParent + " " + (species.label === selectedSpecies ? " " + styles.speciesItemSelected : "")}>
                                                                <div onClick={() => filterSpecies(species)}
                                                                     className={"d-flex justify-content-between " + styles.speciesItem}>
                                                                    <div
                                                                        className={styles.speciesName}>{species.label}</div>
                                                                    <div
                                                                        style={{float: 'right'}}>{species.count}</div>
                                                                </div>
                                                                {species.label === selectedSpecies && (
                                                                    <div className="d-flex pb-2">
                                                                        <button
                                                                            className="btn btn-default btn-sm ms-3"
                                                                            onClick={() => openSpeciesPage(species)}>
                                                                            Species profile
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-default btn-sm ms-3"
                                                                            onClick={() => openBiocacheForSpecies(species)}>
                                                                            List records
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="d-flex mt-3">
                                                <button className="btn btn-sm btn-default"
                                                        onClick={() => openBiocacheForSpecies(null)}>
                                                    View records
                                                </button>
                                                <button className="btn btn-sm btn-default ms-3"
                                                        onClick={openDownloadLink}>
                                                    Download records
                                                </button>
                                            </div>
                                        </Tab>
                                        <Tab eventKey="chart" title="Explore by taxonomy">
                                            <div className={"mt-4 " + styles.pieChart}>
                                                {chartData && chartData.labels && chartData.labels.length > 0 && PieChart(chartData)}
                                                {chartData === undefined &&
                                                    <div className="d-flex justify-content-center">
                                                        <FontAwesomeIcon icon={faSpinner}/>
                                                    </div>}
                                                {chartData !== undefined && Object.keys(chartData).length === 1 &&
                                                    <div className="d-flex justify-content-center">
                                                        <p>No data</p></div>}
                                            </div>
                                            {currentRank > 0 && (
                                                <div className="d-flex mt-3">
                                                    <button className="btn btn-sm btn-default" onClick={drillUpChart}>
                                                        Previous rank
                                                    </button>
                                                    <button className="btn btn-sm btn-default ms-3"
                                                            onClick={() => openBiocacheForSpecies(null)}>
                                                        View records
                                                        for {ranks[currentRank - 1]} {selectedRanks[currentRank - 1]}
                                                    </button>
                                                </div>
                                            )}
                                        </Tab>
                                    </Tabs>
                                </div>
                                <div className={styles.mapPanel}>
                                    <Tabs defaultActiveKey="map">
                                        <Tab eventKey="map" title="Time controls and Map">
                                            <div className={"d-flex justify-content-center " + styles.playerBtns}>
                                                <div>
                                                    {playerState === 'playing' && <i className="bi bi-play-fill"></i>}
                                                    {playerState !== 'playing' &&
                                                        <i className="bi bi-play" onClick={playerPlay}></i>}
                                                </div>
                                                <div>
                                                    {playerState === 'paused' && <i className="bi bi-pause-fill"></i>}
                                                    {playerState !== 'paused' &&
                                                        <i className="bi bi-pause" onClick={playerPause}></i>}
                                                </div>
                                                <div>
                                                    {playerState === 'stopped' && <i className="bi bi-stop-fill"></i>}
                                                    {playerState !== 'stopped' &&
                                                        <i className="bi bi-stop" onClick={playerStop}></i>}
                                                </div>
                                                <div>
                                                    <i className="bi bi-arrow-clockwise" onClick={playerReset}></i>
                                                </div>
                                                <OverlayTrigger
                                                    placement="top"
                                                    overlay={<Tooltip id="tooltip-top">
                                                        How to use time controls: drag handles to restrict date or play
                                                        by
                                                        decade.</Tooltip>}>
                                                    <p className="fw-bold ms-3"><FontAwesomeIcon
                                                        icon={faInfoCircle}/></p>
                                                </OverlayTrigger>
                                            </div>
                                            <div className="mt-2">
                                                <DualRangeSlider
                                                    min={EARLIEST_YEAR}
                                                    max={new Date().getFullYear()}
                                                    minValue={yearMin}
                                                    maxValue={yearMax}
                                                    stepSize={1}
                                                    onChange={(minVal, maxVal) => {
                                                        setYearMin(Math.floor(minVal));
                                                        setYearMax(Math.floor(maxVal));
                                                    }}
                                                    onChangeEnd={yearRangeEnd}
                                                    isDisabled={isFetchingSpeciesList}
                                                ></DualRangeSlider>

                                                <div className="d-flex justify-content-center">
                                                    <p>{yearMin} - {yearMax}</p>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <MapContainer
                                                    ref={mapRef}
                                                    center={center}
                                                    zoom={defaultZoom}
                                                    scrollWheelZoom={false}
                                                    worldCopyJump={true}
                                                    style={{height: '530px', borderRadius: '10px'}}
                                                >
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

                                                    {object && showOccurrences && occurrenceFq !== undefined && (
                                                        <WMSTileLayer
                                                            url={getAlaWmsUrl()}
                                                            layers="ALA:occurrences"
                                                            format="image/png"
                                                            transparent={true}
                                                            opacity={occurrenceOpacity / 100.0}
                                                            attribution="Atlas of Living Australia"
                                                            zIndex={15}
                                                        />
                                                    )}
                                                    {object && showObject && (
                                                        <WMSTileLayer
                                                            url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon&viewparams=s%3A${object.pid}`}
                                                            layers={`ALA:Objects`}
                                                            format="image/png"
                                                            styles="polygon"
                                                            transparent={true}
                                                            opacity={objectOpacity / 100.0}
                                                            zIndex={11}
                                                        />
                                                    )}
                                                </MapContainer>
                                                <div className="d-flex mt-3 mb-2">
                                                    <input type="checkbox" checked={showOccurrences}
                                                           onChange={(e) => setShowOccurrences(e.target.checked)}/>
                                                    <div className="ms-2">Occurrences</div>
                                                </div>
                                                <DualRangeSlider min={0} max={100} minValue={occurrenceOpacity}
                                                                 maxValue={100} stepSize={1}
                                                                 onChange={(minVal) => {
                                                                     setOccurrenceOpacity(Math.floor(minVal));
                                                                 }}
                                                                 isDisabled={!showOccurrences}
                                                                 singleValue={true}/>
                                                <div className="d-flex mt-3 mb-2">
                                                    <input type="checkbox" checked={showObject}
                                                           onChange={(e) => setShowObject(e.target.checked)}/>
                                                    <div className="ms-2">Region</div>
                                                </div>
                                                <DualRangeSlider min={0} max={100} minValue={objectOpacity}
                                                                 maxValue={100} stepSize={1}
                                                                 onChange={(minVal) => {
                                                                     setObjectOpacity(Math.floor(minVal));
                                                                 }}
                                                                 isDisabled={!showObject}
                                                                 singleValue={true}/>
                                            </div>
                                        </Tab>
                                    </Tabs>
                                </div>
                            </div>
                        </Container>
                    }
                </>
            }
        </>
    );
}

export default Region;
