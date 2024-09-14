import { useEffect, useState } from "react";
import { Box, Button, Checkbox, Divider, Flex, Grid, Image, Radio, Skeleton, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconReload } from "@tabler/icons-react";
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
    const [licenceType, setLicenceType] = useState<string[]>([]);
    const [licenceTypeActive, setLicenceTypeActive] = useState<string[]>([]);
    const [includeOccurrences, setIncludeOccurrences] = useState(true);
    const [includeSpecimens, setIncludeSpecimens] = useState(true);
    const [occurrenceCount, setOccurrenceCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const pageSize = 10;

    useEffect(() => {
        fetchImages();
    }, [result, page, sortDir, includeOccurrences, includeSpecimens, type, licenceTypeActive]);

    function fetchImages() {
        if (!result?.guid) {
            return;
        }

        const typeFqMap: Record<PropertyKey, string> = {
            all: "&fq=multimedia:*",
            image: "&fq=multimedia:Image",
            video: "&fq=multimedia:Video",
            sound: "&fq=multimedia:Sound"
        };

        const facets = '&facets=license,dataResourceName';
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
        setLoading(true);
        clearFacetValues();
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            facets +
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
                data.facetResults.map((facet: any) => {
                    if (facet.fieldName === 'license') {
                        facet.fieldResult.map((field: any) => {  
                            setLicenceType([...licenceType, field.label]);
                        })
                    }
                    if (facet.fieldName === 'dataResourceName') {
                        facet.fieldResult.map((field: any) => {  
                            // setDataResources([...dataResources, field.label]);
                        })
                    }
                })

                if (page == 0) {
                    setItems(list);
                    setOccurrenceCount(data.totalRecords);
                } else {
                    setItems([...items, ...list]);
                }
            }).catch(error => {
                console.error('Failed to fetch images - ' + error);
            }).finally(() => {
                setLoading(false);
            });
    }

    const clearFacetValues = () => {
        setLicenceType([]);
        // setLicenceTypeActive([]);
        // setDataResources([]);
    }

    const getImageUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/proxyImageThumbnail?imageId=${id}`;
    }

    function resetView() {
        setPage(0);
    }

    const handleImageError = (idx: number, e: any) => {
        console.log('Image error', e.target?.src, idx);
        setItems(prevItems => prevItems.filter((_, index) => index !== idx));
    };

    const updateLicenceType = (value: string) => {
        if (licenceTypeActive.includes(value)) {
            setLicenceTypeActive(licenceTypeActive.filter(item => item !== value));
        } else {
            setLicenceTypeActive([...licenceTypeActive, value]);
        }
        // alert("Filtering by licence type not yet supported. Licence type: " + licenceTypeActive);
    }

    return (
        <Box>
            <Flex gap="md" mt="md">
                <Button variant={type === 'all' ? 'filled' : 'outline'} onClick={() => {resetView();setType('all')}}>View all</Button>
                <Button variant={type === 'image' ? 'filled' : 'outline'} onClick={() => {resetView();setType('image')}}>Images</Button>
                <Button variant={type === 'sound' ? 'filled' : 'outline'} onClick={() => {resetView();setType('sound')}}>Sounds</Button>
                <Button variant={type === 'video' ? 'filled' : 'outline'} onClick={() => {resetView();setType('video')}}>Videos</Button>
            </Flex>
            <Text mt="lg" mb="md" size="sm" fw="bold">
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
                            <Flex 
                                key={idx}
                                justify="center"
                            >
                                {item.type === 'image' && 
                                    <Image 
                                        radius="md" 
                                        h={210}
                                        maw={280}
                                        src={ getImageUrl(item.id) }
                                        onError={(e) => handleImageError(idx, e)}
                                    />}
                                {item.type === 'sound' && 
                                    <audio key={idx} controls></audio>}
                                {item.type === 'video' && 
                                    <video key={idx} controls></video>}
                            </Flex>
                        )}
                        { loading && 
                            [...Array(10)].map((_ , idx) => 
                                <Box key={idx} w={210} h={250}>
                                    <Skeleton height="100%" width="100%" radius="md" />
                                </Box>
                            )
                        }
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
                    <Divider mt="lg" mb="lg" />
                    <Text fw="bold" mb="md">Record type</Text>
                    <Checkbox checked={includeOccurrences} size="xs" 
                        onChange={() => {setIncludeOccurrences(!includeOccurrences)}} 
                        label="Occurrence records" />
                    <Checkbox checked={includeSpecimens} size="xs"
                        onChange={() => {setIncludeSpecimens(!includeSpecimens)}}
                        label="Specimens" />
                    <Divider mt="lg" mb="lg" />
                    <Text fw="bold" mb="md">Licence type</Text>
                    { licenceType.map((item, idx) => 
                        <Checkbox key={idx} size="xs"
                            checked={licenceTypeActive.includes(item)}
                            onChange={() => { updateLicenceType(item)}}
                            label={item} />
                    )}
                    {/* <Checkbox size="xs"
                        checked={licenceTypeActive.includes('CC0')}
                        onChange={() => { updateLicenceType('CC0')}}
                        label="CC0" />
                    <Checkbox size="xs"  
                        checked={licenceTypeActive.includes('CC-BY')}
                        onChange={() => { updateLicenceType('CC-BY')}}
                        label="CC-BY" />
                    <Checkbox size="xs"  
                        checked={licenceTypeActive.includes('CC-BY-NC')}
                        onChange={() => { updateLicenceType('CC-BY-NC')}}
                        label="CC-BY-NC" />
                    <Checkbox size="xs"  
                        checked={licenceTypeActive.includes('other')}
                        onChange={() => { updateLicenceType('other')}}
                        label="Other" /> */}
                    <Divider mt="lg" mb="lg" />
                    <Text fw="bold" mb="md">Institution</Text>
                    <Button 
                        mt="lg" 
                        variant="default" 
                        radius="xl"
                        fullWidth
                        rightSection={<IconReload />}>Refresh</Button>
                </Grid.Col>
            </Grid>
        </Box>
    );
}

export default ImagesView;