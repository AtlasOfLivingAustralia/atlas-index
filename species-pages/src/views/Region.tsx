import {useEffect, useRef, useState} from "react";
import {useNavigate} from 'react-router-dom';

import {Breadcrumb} from "../api/sources/model.ts";
import {
    Box,
    Button,
    Checkbox,
    Container,
    Flex,
    Grid, RangeSlider,
    Slider,
    Space, Table,
    Tabs,
    Text,
    Title
} from "@mantine/core";
import {MapContainer, TileLayer, WMSTileLayer} from 'react-leaflet';
import {
    IconChevronLeft,
    IconDatabase,
    IconDownload,
    IconExternalLink,
    IconPlayerPause,
    IconPlayerPauseFilled,
    IconPlayerPlay,
    IconPlayerPlayFilled,
    IconPlayerStop,
    IconPlayerStopFilled,
    IconReload,
} from "@tabler/icons-react";

import 'leaflet/dist/leaflet.css';
import {LatLng} from "leaflet";

// TODO: update to use the new species groups, but only after biocache-service is updated
import speciesGroupMapImport from "../config/speciesGroupsMapLegacyRegions.json";
import {Pie} from "react-chartjs-2";

const speciesGroupMap: SpeciesGroupMap = {
    "All Species": {
        name: "All Species",
        children: []
    },
    ...speciesGroupMapImport
};

// TODO: move to the .env file
const center = new LatLng(-28, 133);
const OBJECT_OPACITY = 50;
const OCCURRENCE_OPACITY = 100;
const globalFq = "&fq=species:*&fq=-occurrenceStatus:absent&fq=spatiallyValid:true";
const EARLIEST_YEAR = 1850;
const INTERVAL_MILLISECONDS = 1000; // Interval for the year span player
const defaultZoom = 4;

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

interface SpeciesGroupMap {
    [key: string]: SpeciesGroup;
}

interface SpeciesListItem {
    label: string,
    count: number
}

function Region({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string,
    login?: () => void,
    logout?: () => void
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
    const [yearRange, setYearRange] = useState<[number, number]>([EARLIEST_YEAR, new Date().getFullYear()]);
    const [isFetchingSpeciesList, setIsFetchingSpeciesList] = useState(false);
    const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
    const [group, setGroup] = useState<string | null>(null);
    const [chartData, setChartData] = useState(undefined);
    const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
    const [rankFqs, setRankFqs] = useState<string[]>([]);
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [currentRank, setCurrentRank] = useState<number>(0);

    // needed for the player to work
    const playerStateRef = useRef(playerState);
    const controllerSpeciesListRef = useRef<AbortController>(new AbortController());

    const navigate = useNavigate();

    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);

    useEffect(() => {
        let args = new URLSearchParams(queryString);
        if (args.has('id')) {
            let id = args.get('id');
            if (id) {
                fetchObject(id)
            }
        }
    }, [queryString]);

    function dateFq(newYearRange?: [number, number]) {
        let currentYearRange = newYearRange || yearRange;
        let startYear = currentYearRange ? currentYearRange[0] : EARLIEST_YEAR;
        let endYear = currentYearRange ? currentYearRange[1] : new Date().getFullYear;
        let value = `occurrenceYear:[${startYear}-01-01T00:00:00Z TO ${endYear}-12-31T23:59:59Z]`
        return "&fq=" + encodeURIComponent(value);
    }

    const PieChart = (data: any) => {
        const chartData = data;
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
                    position: "right",
                    labels: {
                        boxWidth: 36,
                        padding: 5,
                        font: {
                            size: 12
                        },
                    },
                    align: "center",
                    title: {
                        display: true,
                        text: ranks[currentRank].charAt(0).toUpperCase() + ranks[currentRank].slice(1)
                    }
                }
            },
            maintainAspectRatio: false,
            // @ts-ignore
            onClick(event: any, elements: any) {
                if (elements.length === 1) {
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

        return <div>
            <Pie
                data={chartData}
                height={350}
                width={400}
                //@ts-ignore
                options={options}
            />
        </div>
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
                {title: 'Species search', href: '/'},
                {title: 'Regions', href: '/regions'},
                {title:  data.name, href: '/regions'}
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
                    playLoop(currentYearRange || yearRange);
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

                    let chart = {
                        labels: labels,
                        datasets: [
                            {
                                data: counts,
                                borderWidth: 1,
                            },
                        ],
                    };

                    //@ts-ignore
                    setChartData(chart);
                } else {
                    //@ts-ignore
                    setChartData({});
                }
            });

        return "chart data";
    }

    function getAlaWmsUrl() {
        if (!object) {
            return '';
        }

        const wmsUrl = `${import.meta.env.VITE_APP_BIOCACHE_URL}/ogc/wms/reflect?q=${object.fid}:\"${encodeURIComponent(object.name)}\"&ENV=color%3AFF0000%3Bname%3Acircle%3Bsize%3A3%3Bopacity%3A0.7&OUTLINE=false${occurrenceFq}${globalFq}${dateFq()}`;
        return wmsUrl;
    }

    function filter(newGroup: any) {
        if (!object) {
            return;
        }

        setGroup(newGroup.name);

        const newFq = newGroup.name !== "All Species" ? `&fq=speciesGroup:\"${encodeURIComponent(newGroup.name)}\"` : '';

        setOccurrenceFq(newFq);

        fetchSpeciesList(object.fid, object.name, newFq);

        redrawMap();

        setSelectedSpecies(null);
    }

    function filterSpecies(species: any) {
        if (group) {
            setOccurrenceFq(`&fq=speciesGroup:\"${encodeURIComponent(group)}\"&fq=species:\"${encodeURIComponent(species.label)}\"`);
        } else {
            setOccurrenceFq(`&fq=species:\"${encodeURIComponent(species.label)}\"`);
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

        // TODO: searchParams is wrong, I think it needs double encoding
        const searchParams = encodeURIComponent(`?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${occurrenceFq}${globalFq}${dateFq()}`);
        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/download?searchParams=${searchParams}`;
        window.open(url, '_blank');
    }

    function openViewLink() {
        if (!object) {
            return;
        }

        const url = `${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${occurrenceFq}`;
        window.open(url, '_blank');
    }

    function yearRangeEnd(newYearRange: [number, number]) {
        if (!object) {
            return;
        }

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
        // TODO: trigger the map update better than this
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
        let currentYearRange = yearRange;
        if (playerStateRef.current == 'stopped') {
            // reset the year range
            currentYearRange = [EARLIEST_YEAR, Math.min(EARLIEST_YEAR + 10, new Date().getFullYear())];
            setYearRange(currentYearRange);
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
                setYearRange(nextYearRange);
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
            setYearRange([EARLIEST_YEAR, new Date().getFullYear()]);
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
                    navigate(`/species/${taxonId}`);
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

        // TODO: I think "query" should be encoded, but that is not the case in production on the existing regions app
        const query = `/occurrences/search?q=${object.fid}:\"${encodeURIComponent(object.name)}\"${globalFq}`;

        const url = `${import.meta.env.VITE_APP_ALERTS_URL}/webservice/createBiocacheNewRecordsAlert?webserviceQuery=${query}&uiQuery=${query}&queryDisplayName=${object.name}&baseUrlForWS=${import.meta.env.VITE_APP_BIOCACHE_URL}/ws&baseUrlForUI=${import.meta.env.VITE_APP_BIOCACHE_UI_URL}&resourceName=${import.meta.env.VITE_APP_ALERT_RESOURCE_NAME}`;
        window.open(url, '_blank');
    }

    return (
        <>
        {(occurrenceCount < 0 || speciesCount < 0) && <Flex mt={60} justify="center"><Text>Loading...</Text></Flex>}
        {occurrenceCount >= 0 && speciesCount >= 0 &&
            <>
                {object &&
                    <Container size="lg" mt="60px">
                        <div style={{display: "flex", justifyContent: "space-between"}}>
                            <Title order={3}>{object.name}</Title>
                            <Button onClick={createAlert}>Alerts</Button>
                        </div>
                        <Title order={4} mt={30}>Occurrence records ({occurrenceCount})</Title>
                        <Title order={4} mt={15}>Number of species ({speciesCount})</Title>

                        <Grid gutter={30} mt={20}>
                            <Grid.Col span="content">
                                <Box w={535}>
                                    <Tabs defaultValue="species" onChange={tabChanged}>
                                        <Tabs.List>
                                            <Tabs.Tab value="species">
                                                Explore by species
                                            </Tabs.Tab>
                                            <Tabs.Tab value="chart">
                                                Explore by taxonomy
                                            </Tabs.Tab>
                                        </Tabs.List>

                                        <Tabs.Panel value="species">
                                            <Table mt={10} h={550}>
                                                <Table.Thead>
                                                    <Table.Tr>
                                                        <Table.Th>Group</Table.Th>
                                                        <Table.Th>Species</Table.Th>
                                                    </Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    <Table.Tr>
                                                        <Table.Td style={{verticalAlign: "top"}}>
                                                            <div style={{width: "150px"}}>
                                                                {speciesGroupMap && Object.keys(speciesGroupMap).map((key) => {
                                                                    return (
                                                                        <>
                                                                            {(speciesGroupFacet[key] || key === "All Species") && <>
                                                                                <Text
                                                                                    onClick={() => isFetchingSpeciesList || filter(speciesGroupMap[key])}
                                                                                    style={{cursor: (isFetchingSpeciesList ? "wait" : "pointer")}}>
                                                                                    {speciesGroupMap[key].name}</Text>
                                                                                {speciesGroupMap[key].children && speciesGroupMap[key].children.map((child) => {
                                                                                    return (
                                                                                        <>
                                                                                            {speciesGroupFacet[child.name] && <>
                                                                                                <Text ml={20}
                                                                                                      onClick={() => isFetchingSpeciesList || filter(child)}
                                                                                                      style={{cursor: (isFetchingSpeciesList ? "wait" : "pointer")}}>{child.name}</Text>
                                                                                                {child.children && child.children.map((child2) => {
                                                                                                    return (
                                                                                                        <>
                                                                                                            {speciesGroupFacet[child2.name] && <>
                                                                                                                <Text
                                                                                                                    ml={40}
                                                                                                                    onClick={() => isFetchingSpeciesList || filter(child2)}
                                                                                                                    style={{cursor: (isFetchingSpeciesList ? "wait" : "pointer")}}>{child2.name}</Text>
                                                                                                            </>}
                                                                                                        </>
                                                                                                    )
                                                                                                })}
                                                                                            </>}
                                                                                        </>
                                                                                    )
                                                                                })}
                                                                            </>
                                                                            }
                                                                        </>
                                                                    )
                                                                })}
                                                            </div>

                                                        </Table.Td>
                                                        <Table.Td style={{verticalAlign: "top"}}>
                                                            <div style={{
                                                                maxHeight: "500px",
                                                                width: "350px",
                                                                overflowY: "auto",
                                                                paddingRight: "20px"
                                                            }}>
                                                                {speciesList && speciesList.map((species, idx) => {
                                                                    return (
                                                                        <div key={idx}>
                                                                            <div onClick={() => filterSpecies(species)}
                                                                                 style={{cursor: "pointer"}}>
                                                                                <Text style={{
                                                                                    display: "inline-block",
                                                                                    maxWidth: "300px"
                                                                                }}>{species.label}</Text>
                                                                                <Text
                                                                                    style={{float: "right"}}>{species.count}</Text>
                                                                            </div>
                                                                            {species.label == selectedSpecies &&
                                                                                <Flex>
                                                                                    <Button ml={20} size={"xs"}
                                                                                            variant="default"
                                                                                            onClick={() => openSpeciesPage(species)}
                                                                                            leftSection={<IconExternalLink
                                                                                                size={14}/>}
                                                                                    >Species profile</Button>
                                                                                    <Button ml={20} size={"xs"}
                                                                                            variant="default"
                                                                                            onClick={() => openBiocacheForSpecies(species)}
                                                                                            leftSection={<IconDatabase
                                                                                                size={14}/>}>List
                                                                                        records</Button>
                                                                                </Flex>
                                                                            }
                                                                        </div>
                                                                    )
                                                                })}
                                                                {speciesList && speciesList.length == 0 &&
                                                                    <Text>No species found</Text>}
                                                            </div>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                </Table.Tbody>
                                            </Table>
                                            <Flex mt={20}>
                                                <Button onClick={openViewLink}
                                                        leftSection={<IconExternalLink size={16}/>}
                                                >View records</Button>
                                                <Button ml={100} onClick={openDownloadLink}
                                                        leftSection={<IconDownload size={16}/>}
                                                >Download records</Button>
                                            </Flex>

                                        </Tabs.Panel>

                                        <Tabs.Panel value="chart">
                                            <Space h={30}/>
                                            <Box h={500}>
                                                {chartData && Object.keys(chartData).length > 0 && PieChart(chartData)}
                                                {chartData === undefined &&
                                                    <Flex justify="center"><Text>Loading...</Text></Flex>}
                                                {chartData !== undefined && Object.keys(chartData).length == 0 &&
                                                    <Flex justify="center"><Text>No data</Text></Flex>}
                                            </Box>
                                            {currentRank > 0 &&
                                                <Flex mt={30}>
                                                    <Button variant='default' onClick={drillUpChart}
                                                            leftSection={<IconChevronLeft/>}>Previous rank</Button>
                                                    <Button ml={20} variant='default' onClick={openBiocacheForChart}
                                                            leftSection={<IconExternalLink/>}>View records
                                                        for {ranks[currentRank - 1]} {selectedRanks[currentRank - 1]}</Button>
                                                </Flex>
                                            }
                                        </Tabs.Panel>
                                    </Tabs>
                                </Box>
                            </Grid.Col>
                            <Grid.Col span="content">
                                <Box w={535}>
                                    <Text fw={600}>Time controls</Text>
                                    <Flex justify="center">
                                        <div>
                                            {playerState === 'playing' && <IconPlayerPlayFilled size={18}/>}
                                            {playerState !== 'playing' && <IconPlayerPlay size={18} onClick={playerPlay}/>}
                                        </div>
                                        <div>
                                            {playerState === 'paused' && <IconPlayerPauseFilled size={18}/>}
                                            {playerState !== 'paused' && <IconPlayerPause size={18} onClick={playerPause}/>}
                                        </div>
                                        <div>
                                            {playerState === 'stopped' && <IconPlayerStopFilled size={18}/>}
                                            {playerState !== 'stopped' && <IconPlayerStop size={18} onClick={playerStop}/>}
                                        </div>
                                        <div>
                                            <IconReload size={18} onClick={playerReset}/>
                                        </div>

                                    </Flex>
                                    <Space h={10}/>
                                    <RangeSlider value={yearRange} onChange={setYearRange} min={EARLIEST_YEAR}
                                                 max={new Date().getFullYear()}
                                                 onChangeEnd={yearRangeEnd} disabled={isFetchingSpeciesList}/>
                                    <Flex justify="center">
                                        <Text>{yearRange[0]} - {yearRange[1]}</Text>
                                    </Flex>
                                    <Space h={20}/>

                                    <MapContainer
                                        ref={mapRef}
                                        center={center}
                                        zoom={defaultZoom}
                                        scrollWheelZoom={false}
                                        worldCopyJump={true}
                                        style={{height: "530px", borderRadius: "10px"}}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://spatial.ala.org.au/osm/{z}/{x}/{y}.png"
                                            zIndex={1}
                                        />
                                        {object && showOccurrences && occurrenceFq !== undefined &&
                                            <WMSTileLayer
                                                url={getAlaWmsUrl()}
                                                layers="ALA:occurrences"
                                                format="image/png"
                                                transparent={true}
                                                opacity={occurrenceOpacity / 100.0}
                                                attribution="Atlas of Living Australia"
                                                zIndex={15}
                                            />
                                        }
                                        {object && showObject && <WMSTileLayer
                                            url={`${import.meta.env.VITE_SPATIAL_URL}/geoserver/wms?styles=polygon&viewparams=s%3A${object.pid}`}
                                            layers={`ALA:Objects`}
                                            format="image/png"
                                            styles="polygon"
                                            transparent={true}
                                            opacity={objectOpacity / 100.0}
                                            zIndex={11}
                                        />}
                                    </MapContainer>
                                    <Flex mt={20}>
                                        <Checkbox checked={showOccurrences} size="16"
                                                  onChange={(event) => setShowOccurrences(event.currentTarget.checked)}
                                        /><Text ml={10} fz={16}>Occurrences</Text>
                                    </Flex>
                                    <Slider value={occurrenceOpacity} onChangeEnd={setOccurrenceOpacity}
                                            disabled={!showOccurrences}/>
                                    <Flex mt={20}>
                                        <Checkbox checked={showObject} size="16"
                                                  onChange={(event) => setShowObject(event.currentTarget.checked)}
                                        /><Text ml={10} fz={16}>Region</Text>
                                    </Flex>
                                    <Slider value={objectOpacity} onChangeEnd={setObjectOpacity} disabled={!showObject}/>
                                </Box>
                            </Grid.Col>
                        </Grid>
                    </Container>
                }
            </>
        }
        </>
    );
}

export default Region;
