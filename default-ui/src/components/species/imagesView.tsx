import { Anchor, Box, Button, Checkbox, Divider, Flex, Grid, Image, Radio, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconReload } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import classes from "./species.module.css";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any >
}

interface Occurrence {
    images: string[];
    videos: string[];
    sound: string[];
}

interface Items {
    id: string;
    type: string;
}   

function ImagesView({result}: MapViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    const [page, setPage] = useState<number>(0);
    const [type, setType] = useState<string>('all');
    const [sortDir, setSortDir] = useState('desc');
    const [includeOccurrences, setIncludeOccurrences] = useState(true);
    const [includeSpecimens, setIncludeSpecimens] = useState(true);
    const [occurrenceCount, setOccurrenceCount] = useState(0);

    const pageSize = 10;

    useEffect(() => {
        fetchImages()
    }, [result, page, sortDir, includeOccurrences, includeSpecimens, type]);

    function fetchImages() {
        if (!result?.guid) {
            return
        }

        const typeFqMap: Record<PropertyKey, string> = {
            all: "&fq=multimedia:*",
            image: "&fq=multimedia:Image",
            video: "&fq=multimedia:Video",
            sound: "&fq=multimedia:Sound"
        };

        const typeFq = typeFqMap[type] || "";

        let specimenFq;
        if (includeSpecimens && includeOccurrences) {
            specimenFq = '&fq=(-typeStatus:*%20AND%20-basisOfRecord:PreservedSpecimen%20AND%20-identificationQualifier:"Uncertain"%20AND%20spatiallyValid:true%20AND%20-userAssertions:50001%20AND%20-userAssertions:50005)%20OR%20(basisOfRecord:PreservedSpecimen%20AND%20-typeStatus:*)'
        } else if (includeSpecimens) {
            specimenFq = '&fq=basisOfRecord:PreservedSpecimen&fq=-typeStatus:*'
        } else if (includeOccurrences) {
            specimenFq = '&fq=-typeStatus:*&fq=-basisOfRecord:PreservedSpecimen&fq=-identificationQualifier:"Uncertain"&fq=spatiallyValid:true&fq=-userAssertions:50001&fq=-userAssertions:50005'
        } else {
            setItems([]);
        }

        let mediaFilter = '&qualityProfile=ALA&fq=-(duplicateStatus:ASSOCIATED%20AND%20duplicateType:DIFFERENT_DATASET)'

        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            '&start=' + (page * pageSize) +
            '&pageSize=' + pageSize +
            '&dir=' + sortDir +
            '&sort=eventDate' +
            typeFq +
            specimenFq +
            mediaFilter)
            .then(response => response.json())
            .then(data => {
                let list: { id: string, type: string }[] = [];
                data.occurrences.map((item: Occurrence) => {
                    if (item.images && (type === 'all' || type === 'image')) {
                        for (let id of item.images) {
                            list.push({id: id, type: 'image'});
                        }
                    }
                    if (item.videos && (type === 'all' || type === 'video')) {
                        for (let id of item.videos) {
                            list.push({id: id, type: 'video'});
                        }
                    }
                    if (item.sound && (type === 'all' || type === 'sound')) {
                        for (let id of item.sound) {
                            list.push({id: id, type: 'sound'});
                        }
                    }
                })
                if (page == 0) {
                    setItems(list);
                    setOccurrenceCount(data.totalRecords);
                } else {
                    setItems([...items, ...list]);
                }
            });
    }


    function resetView() {
        setPage(0);
        // setItems([]);
    }

    return <>
        <Box>
            <Flex gap="md">
                <Button variant={type === 'all' ? 'filled' : 'outline'}   onClick={() => {resetView();setType('all')}}>View all</Button>
                <Button variant={type === 'image' ? 'filled' : 'outline'} onClick={() => {resetView();setType('image')}}>Images</Button>
                <Button variant={type === 'sound' ? 'filled' : 'outline'} onClick={() => {resetView();setType('sound')}}>Sounds</Button>
                <Button variant={type === 'video' ? 'filled' : 'outline'} onClick={() => {resetView();setType('video')}}>Videos</Button>
            </Flex>
            {/* <div className="d-flex">
                <div className={"btn " + (type === 'all' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                    onClick={() => {resetView();setType('all')}}>View all</div>
                <div className={"btn  " + (type === 'image'? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                    onClick={() => {resetView();setType('image')}}>Images</div>
                <div className={"btn  " + (type === 'sound' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                    onClick={() => {resetView();setType('sound')}}>Sounds</div>
                <div className={"btn  " + (type === 'video' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                    onClick={() => {resetView();setType('video')}}>Videos</div>
            </div> */}

            <Text mt="md" mb="md" size="sm" fw="bold">
                Showing {occurrenceCount > 0 ? (page+1)*pageSize : 0} of {occurrenceCount} results
            </Text>
            <Grid>
                <Grid.Col span={9}>
                    <Flex gap="sm" 
                        justify="flex-start"
                        align="flex-start"
                        direction="row"
                        wrap="wrap"
                    >
                        {items && items.map((item, idx) =>
                            <Box key={idx}>
                                {item.type === 'image' && 
                                    <Image className="speciesImageBlockImg" key={idx} src={"https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=" + item.id}></Image>}
                                {item.type === 'sound' && 
                                    <audio key={idx} controls></audio>}
                                {item.type === 'video' && 
                                    <video key={idx} controls></video>}
                            </Box>
                        )}
                    </Flex>
                </Grid.Col>
                <Grid.Col span={3}>
                    <Flex justify="flex-start" align="center" gap="sm">
                        <IconAdjustmentsHorizontal />
                        <Text fw="bold">Refine view</Text>
                    </Flex>
                    <Divider mt="lg" mb="lg" />
                    <Radio.Group 
                        classNames={{ label: classes.gallerySortLabel }}
                        value={sortDir}
                        onChange={setSortDir}
                        label="Sort by"
                    >
                        <Radio size="xs" value="desc"
                            label="Latest" />
                        <Radio size="xs"  value="asc"
                            label="Oldest" />
                    </Radio.Group>
                    {/* <Checkbox 
                        size="xs" 
                        checked={sortDir === 'desc'}
                        onChange={(e) => {
                            if (e.target.checked) {
                                resetView();
                                setSortDir('desc')
                            }
                        }}
                        label="Sort by" 
                    /> */}
                    <Divider mt="lg" mb="lg" />
                    <Text fw="bold" mb="md">Expert distribution maps</Text>
                    {/* { distributions && distributions.map((dist, idx) =>
                        <Box key={idx}>
                            <Checkbox checked={dist.checked} size="xs" 
                                id={"dist" + idx}
                                label={dist.areaName} />
                            <Text fz="sm" ml="xl">
                                provided by&nbsp;
                                <Anchor inherit href="#">{dist.dataResourceName}</Anchor>
                            </Text>
                        </Box>
                    )} */}
                    <Divider mt="lg" mb="lg" />
                    {/* <Text fw="bold" mb="md">Map type</Text>
                    <Radio.Group 
                        value={mapControls}
                        onChange={setMapControls}
                    > 
                        <Radio size="xs" value="default"
                            label="Default" />
                        <Radio size="xs"  value="terrain"
                            label="Terrain" />
                    </Radio.Group> */}
                    <Button 
                        mt="lg" 
                        variant="default" 
                        radius="xl"
                        fullWidth
                        rightSection={<IconReload />}>Refresh</Button>
                </Grid.Col>
            </Grid>
                {/* <div className="speciesImagesControl">
                    <div className="speciesRefineView"><span className="bi bi-sliders"></span>Refine results</div>
                    <div className="speciesMapControlItem speciesMapControlItemHr">
                        <div className="speciesMapControlDist">Sort by</div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="radio" value="desc" name="sortBy" id={"sortBy1"}
                                    checked={sortDir === 'desc'}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            resetView();
                                            setSortDir('desc')}}}/>
                            <label className="form-check-label" htmlFor={"sortBy1"}>
                                Latest
                            </label>
                        </div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="radio" value="asc" name="sortBy" id={"sortBy2"}
                                    checked={sortDir === 'asc'}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            resetView();
                                            setSortDir('asc')}}}/>
                            <label className="form-check-label" htmlFor={"sortBy2"}>
                                Oldest
                            </label>
                        </div>
                    </div>

                    <div className="speciesMapControlItem">
                        <div className="speciesMapControlDist">Record type</div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="checkbox" checked={includeOccurrences} id={"typeOccurrence"}
                                onChange={() => {
                                    resetView(); setIncludeOccurrences(!includeOccurrences)}}/>
                            <label className="form-check-label" htmlFor={"typeOccurrence"}>
                                Occurrences
                            </label>
                        </div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="checkbox" checked={includeSpecimens} id={"typeSpecimens"}
                                onChange={() => {resetView();setIncludeSpecimens(!includeSpecimens)}}/>
                            <label className="form-check-label" htmlFor={"typeSpecimens"}>
                                Specimens
                            </label>
                        </div>
                    </div>

                    <div className="speciesMapControlRefresh">
                        Refresh <span className="bi bi-arrow-clockwise"></span>
                    </div>

                </div> */}
            {/* </Flex> */}
        </Box>
    </>
}

export default ImagesView;
