import {useEffect, useRef, useState} from "react";

import {Breadcrumb} from "../api/sources/model.ts";

import {MapContainer, TileLayer, WMSTileLayer} from 'react-leaflet';
import FontAwesomeIcon from '../components/icon/fontAwesomeIconLite'

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";
import {formatNumber} from "../components/util/FormatNumber.tsx"
import "./region.css"

import speciesGroupMapImport from "../config/speciesGroupsMapLegacyRegions.json";

import {Container, OverlayTrigger, Tab, Tabs, Tooltip} from "react-bootstrap";
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner'
import {faInfoCircle} from '@fortawesome/free-solid-svg-icons/faInfoCircle';


import {Pie} from "react-chartjs-2";
import {Chart, ArcElement, BarElement, Legend} from 'chart.js'
import DualRangeSlider from "../components/common-ui/dualRangeSlider.tsx";

Chart.register(ArcElement, BarElement, Legend);

const customColors = [
    '#003A70', '#F26649', '#6BDAD5', '#EB9D07', '#A191B2', '#FFC557', '#D9D9D9'
];

const speciesGroups: SpeciesGroupItem[] = [
    {
        name: "All Species",
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

const center = new LatLng(Number(import.meta.env.VITE_MAP_CENTRE_LAT), Number(import.meta.env.VITE_MAP_CENTRE_LNG));
const OBJECT_OPACITY = 50; // 0 to 100
const OCCURRENCE_OPACITY = 100; // 0 to 100
const defaultZoom = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM);
const globalFq = import.meta.env.VITE_GLOBAL_FQ;
const EARLIEST_YEAR = Number(import.meta.env.VITE_EARLIEST_YEAR);
const INTERVAL_MILLISECONDS = Number(import.meta.env.VITE_PLAYER_INTERVAL_MILLISECONDS);

interface SpatialObject {
    pid: string,
    fid: string,
    name: string,
    bbox: string,
    description: string,
    centroid: [number, number]
}

interface SpeciesGroup {
    name: string,
    children?: SpeciesGroup[]
}

interface SpeciesGroupItem {
    name: string,
    indent: number
}

interface SpeciesListItem {
    label: string,
    count: number
}

interface ChartData {
    labels: string[];
    datasets?: {
        data: number[];
        borderWidth: number;
    }[];
}

function Region({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}) {

    const [occurrenceCount, setOccurrenceCount] = useState(-1);
    const [speciesCount, setSpeciesCount] = useState(-1);
    const [showOccurrences, setShowOccurrences] = useState(true);
    const mapRef = useRef<L.Map | null>(null);
    const [showObject, setShowObject] = useState(true);
    const [objectOpacity, setObjectOpacity] = useState(OBJECT_OPACITY);
    const [occurrenceOpacity, setOccurrenceOpacity] = useState(OCCURRENCE_OPACITY);
    const [object, setObject] = useState<SpatialObject | undefined>(undefined);
    const [occurrenceFq, setOccurrenceFq] = useState('');
    const [speciesGroupFacet, setSpeciesGroupFacet] = useState<{ [key: string]: number }>({});
    const [speciesList, setSpeciesList] = useState<SpeciesListItem[] | undefined>(undefined);
    const [playerState, setPlayerState] = useState<string>('stopped'); // 'stopped', 'playing', 'paused'paused'
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
    const [isFetchingSpeciesList, setIsFetchingSpeciesList] = useState(false);
    const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
    const [group, setGroup] = useState<string | null>(null);
    const [chartData, setChartData] = useState<ChartData | undefined>(undefined);
    const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
    const [rankFqs, setRankFqs] = useState<string[]>([]);
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [currentRank, setCurrentRank] = useState<number>(0);
    const [yearMin, setYearMin] = useState(EARLIEST_YEAR);
    const [yearMax, setYearMax] = useState(new Date().getFullYear());

    // needed for the player to work
    const playerStateRef = useRef(playerState);
    const controllerSpeciesListRef = useRef<AbortController>(new AbortController());

    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);

    useEffect(() => {
        // get the id from the query hash, specifically the id parameter
        const hash = window.location.hash;
        const queryString = hash.split('?')[1];
        const searchParams = new URLSearchParams(queryString);
        const id = searchParams.get('id');
        if (id) {
            fetchObject(id);
        }
    }, []);

    function dateFq(newYearRange?: [number, number]) {
        let currentYearRange = newYearRange || [yearMin, yearMax];
        let startYear = currentYearRange ? currentYearRange[0] : EARLIEST_YEAR;
        let endYear = currentYearRange ? currentYearRange[1] : new Date().getFullYear;
        let value = `occurrenceYear:[${startYear}-01-01T00:00:00Z TO ${endYear}-12-31T23:59:59Z]`
        return "&fq=" + encodeURIComponent(value);
    }

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

                    // drill down, with debounce
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

            setBreadcrumbs([
                {title: 'Home', href: import.meta.env.VITE_HOME_URL},
                {title: "Explore", href: import.meta.env.VITE_EXPLORE_URL},
                {title: 'Regions', href: '/'},
                {title: data.name, href: ''}
            ]);

            // get speciesGroup facet
            const url2 = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${data.fid}:\"${encodeURIComponent(data.name)}\"&facets=speciesGroup&pageSize=0&flimit=-1${globalFq}${dateFq()}`;
            const response2 = await fetch(url2);
            const data2 = await response2.json();
            if (data2.facetResults && data2.facetResults[0]) {
                const counts: { [key: string]: number } = {}
                for (const item of data2.facetResults[0].fieldResult) {
                    counts[item.label] = item.count;
                }
                setSpeciesGroupFacet(counts);
                setOccurrenceCount(data2.totalRecords);

                fetchSpeciesList(data.fid, data.name, '');
                fetchChartData(data.fid, data.name);
            } else {
                setSpeciesGroupFacet({});
                setOccurrenceCount(0);
            }
        }
    }

    function fetchSpeciesList(fid: string, name: string, fq: string, currentYearRange?: [number, number]) {
        setIsFetchingSpeciesList(true);
        setSpeciesList(undefined);

        // Reset the AbortController
        if (controllerSpeciesListRef.current) {
            controllerSpeciesListRef.current.abort();
        }
        controllerSpeciesListRef.current = new AbortController();
        const signalSpeciesList = controllerSpeciesListRef.current.signal;

        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=${fid}:\"${encodeURIComponent(name)}\"${fq}&pageSize=0&flimit=-1&facets=species${globalFq}${dateFq(currentYearRange)}`;
        fetch(url, {signal: signalSpeciesList})
            .then(response => response.json())
            .then(data => {
                if (data.facetResults && data.facetResults[0]) {
                    setOccurrenceCount(data.totalRecords);
                    setSpeciesCount(data.facetResults[0].fieldResult.length);
                    setSpeciesList(data.facetResults[0].fieldResult);
                } else {
                    setOccurrenceCount(0);
                    setSpeciesCount(0);
                    setSpeciesList([]);
                }
                setIsFetchingSpeciesList(false);

                if (playerStateRef.current === 'playing') {
                    playLoop(currentYearRange || [yearMin, yearMax]);
                }
            }).catch((error) => {
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

    function fetchChartData(fid: string, name: string, newRank?: number, newOccurrenceFq?: string, currentYearRange?: [number, number]) {
        setChartData(undefined);
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
                    setChartData({labels: []});
                }
            });

        return "chart data";
    }

    function getAlaWmsUrl() {
        if (!object) {
            return '';
        }

        return `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=${object.fid}:\"${encodeURIComponent(object.name)}\"&ENV=color%3AC44D34%3Bname%3Acircle%3Bsize%3A3%3Bopacity%3A0.7&OUTLINE=false${occurrenceFq}${globalFq}${dateFq()}`;
    }

    function filter(newGroup: any) {
        if (!object) {
            return;
        }

        if (newGroup.name === group) {
            return;
        }

        setGroup(newGroup.name);

        const newFq = newGroup.name !== "All Species" ? `&fq=${encodeURIComponent(`speciesGroup:\"${newGroup.name}\"`)}` : '';

        setOccurrenceFq(newFq);

        fetchSpeciesList(object.fid, object.name, newFq);

        redrawMap();

        setSelectedSpecies(null);
    }

    function filterSpecies(species: any) {
        if (group) {
            setOccurrenceFq(`&fq=${encodeURIComponent(`speciesGroup:\"${group}\"`)}&fq=${encodeURIComponent(`species:\"${species.label}\"`)}`);
        } else {
            setOccurrenceFq(`&fq=${encodeURIComponent(`species:\"${species.label}\"`)}`);
        }

        redrawMap();

        setSelectedSpecies(species.label);
    }

    function zoomToExtents(extents: [[number, number], [number, number]]) {
        if (!mapRef.current) {
            setTimeout(() => {
                zoomToExtents(extents);
            }, 50);
            return;
        }

        mapRef.current.fitBounds(extents);
    }

    function openDownloadLink() {
        if (!object) {
            return;
        }

        const q = `${object.fid}:"${object.name}"`
        const params = `?q=${encodeURIComponent(q)}${occurrenceFq}${globalFq}${dateFq()}`;
        const searchParams = encodeURIComponent(params); // encode the whole query
        const url = `${import.meta.env.VITE_DOWNLOAD_URL}${searchParams}`;
        window.open(url, '_blank');
    }

    function openViewLink() {
        if (!object) {
            return;
        }

        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${occurrenceFq}`;
        window.open(url, '_blank');
    }

    function yearRangeEnd() {
        if (!object) {
            return;
        }

        const newYearRange: [number, number] = [yearMin, yearMax];

        fetchSpeciesList(object.fid, object.name, occurrenceFq, newYearRange);

        fetchChartData(object.fid, object.name, currentRank, occurrenceFq, newYearRange);

        redrawMap();

        // species selection is cleared when the year range changes, so set it to null and reset the occurrenceFq
        if (selectedSpecies) {
            if (group) {
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

    function playerPlay() {
        if (!object) {
            return;
        }

        setPlayerState('playing');
        let currentYearRange: [number, number] = [yearMin, yearMax];
        if (playerStateRef.current == 'stopped') {
            console.log('playerPlay: stopped');
            // reset the year range
            currentYearRange = [EARLIEST_YEAR, Math.min(EARLIEST_YEAR + 10, new Date().getFullYear())];
            console.log('playerPlay: currentYearRange', EARLIEST_YEAR, currentYearRange, Math.min(EARLIEST_YEAR + 10, new Date().getFullYear()));
            setYearMin(currentYearRange[0]);
            setYearMax(currentYearRange[1]);
            redrawMap();

            fetchSpeciesList(object.fid, object.name, occurrenceFq, currentYearRange);
        }

        playLoop(currentYearRange);
    }

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

    function openSpeciesPage(species: any) {
        if (!object) {
            return;
        }

        // need the taxonId first, do a biocache query to get it
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

    function openBiocacheForSpecies(species: any) {
        if (!object) {
            return;
        }

        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"&fq=species:\"${encodeURIComponent(species.label)}\"${occurrenceFq}${globalFq}${dateFq()}`;
        window.open(url, '_blank');
    }

    function tabChanged() {
        if (!object) {
            return;
        }

        // reset stuff
        setGroup(null);
        setSelectedSpecies(null);
        setOccurrenceFq('');
        setSpeciesList(undefined);
        setChartData(undefined);
        setCurrentRank(0);
        setRankFqs([]);
        setSelectedRanks([]);

        fetchSpeciesList(object.fid, object.name, '');
        fetchChartData(object.fid, object.name, 0, '');

        redrawMap();
    }

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

    function openBiocacheForChart() {
        if (!object) {
            return;
        }

        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${occurrenceFq}${globalFq}${dateFq()}`;
        window.open(url, '_blank');
    }

    function createAlert() {
        if (!object) {
            return;
        }

        const query = `/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${globalFq}`;
        const url = `${import.meta.env.VITE_APP_ALERTS_URL}/webservice/createBiocacheNewRecordsAlert?webserviceQuery=${query}&uiQuery=${query}&queryDisplayName=${object.name}&baseUrlForWS=${import.meta.env.VITE_APP_BIOCACHE_URL}/ws&baseUrlForUI=${import.meta.env.VITE_APP_BIOCACHE_UI_URL}&resourceName=${import.meta.env.VITE_APP_ALERT_RESOURCE_NAME}`;
        window.open(url, '_blank');
    }

    return (
        <>
            {(occurrenceCount < 0 || speciesCount < 0) &&
                <div className="d-flex justify-content-center align-items-center pageLoading">
                    <FontAwesomeIcon icon={faSpinner}/>
                </div>}
            {occurrenceCount >= 0 && speciesCount >= 0 &&
                <>
                    {object &&
                        <Container className="mt-5">
                            <div className="d-flex justify-content-between">
                                <h2>{object.name}</h2>
                                <button className="btn btn-primary" onClick={createAlert}>Alerts</button>
                            </div>
                            <h3 className="mt-4">Occurrence records ({formatNumber(occurrenceCount)})</h3>
                            <h3 className="mt-3">Number of species ({formatNumber(speciesCount)})</h3>

                            <div className="regionSections">
                                <div className="tabPanel">
                                    <Tabs defaultActiveKey="species" onSelect={tabChanged}>
                                        <Tab eventKey="species" title="Explore by species">
                                            <div className="regionPanelGroup">
                                                <div className="d-flex regionHeader">
                                                    <div className="regionPanel regionLeft">Group</div>
                                                    <div className="regionPanel">Species</div>
                                                </div>

                                                <div className="d-flex">
                                                    <div className="regionPanel regionLeft">
                                                        {speciesGroupFacet && speciesGroups.filter(group => speciesGroupFacet[group.name] || group.name === "All Species").map((group, idx) =>
                                                            <div key={idx}
                                                                 onClick={() => isFetchingSpeciesList || filter(group)}
                                                                 className={"speciesItemParent speciesItem" + (group.indent > 0 ? " ms-" + group.indent * 2 : "")}
                                                                 style={{cursor: isFetchingSpeciesList ? 'wait' : 'pointer'}}>
                                                                {group.name}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="regionPanel">
                                                        {!speciesList &&
                                                            <div className="d-flex justify-content-center mt-2">
                                                                <FontAwesomeIcon icon={faSpinner}/>
                                                            </div>}
                                                        {speciesList && speciesList.length === 0 &&
                                                            <p>No species found</p>}
                                                        {speciesList && speciesList.map((species, idx) => (
                                                            <div key={idx}
                                                                 className={"speciesItemParent" + (species.label === selectedSpecies ? " speciesItemSelected" : "")}>
                                                                <div onClick={() => filterSpecies(species)}
                                                                     className="d-flex justify-content-between speciesItem">
                                                                    <div
                                                                        className="speciesName">{species.label}</div>
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
                                                <button className="btn btn-default" onClick={openViewLink}>
                                                    View records
                                                </button>
                                                <button className="btn btn-default ms-3" onClick={openDownloadLink}>
                                                    Download records
                                                </button>
                                            </div>
                                        </Tab>
                                        <Tab eventKey="chart" title="Explore by taxonomy">
                                            <div className="mt-4 pieChart">
                                                {chartData && chartData.labels.length > 0 && PieChart(chartData)}
                                                {chartData === undefined &&
                                                    <div className="d-flex justify-content-center">
                                                        <FontAwesomeIcon icon={faSpinner}/>
                                                    </div>}
                                                {chartData !== undefined && Object.keys(chartData).length === 0 &&
                                                    <div className="d-flex justify-content-center">
                                                        <p>No data</p></div>}
                                            </div>
                                            {currentRank > 0 && (
                                                <div className="d-flex mt-3">
                                                    <button className="btn btn-default" onClick={drillUpChart}>
                                                        Previous rank
                                                    </button>
                                                    <button className="btn btn-default ms-3"
                                                            onClick={openBiocacheForChart}>
                                                        View records
                                                        for {ranks[currentRank - 1]} {selectedRanks[currentRank - 1]}
                                                    </button>
                                                </div>
                                            )}
                                        </Tab>
                                    </Tabs>
                                </div>
                                <div className="mapPanel">
                                    <Tabs defaultActiveKey="map">
                                        <Tab eventKey="map" title="Time controls and Map">
                                            <div className="d-flex justify-content-center playerBtns">
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
                                                        How to use time controls: drag handles to restrict date or play by
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
                                                    <TileLayer
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                        url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                                                        zIndex={1}
                                                    />
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
                                                <DualRangeSlider min={0} max={100} minValue={occurrenceOpacity} maxValue={100} stepSize={1}
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
                                                <DualRangeSlider min={0} max={100} minValue={objectOpacity} maxValue={100} stepSize={1}
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
