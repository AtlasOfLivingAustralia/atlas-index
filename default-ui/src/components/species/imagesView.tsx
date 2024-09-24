import { useCallback, useEffect, useState } from "react";
import { Anchor, Badge, Box, Button, Checkbox, Collapse, Divider, Flex, Grid, Image, Modal, Pill, Radio, Skeleton, Text, UnstyledButton } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconChevronDown, IconChevronRight, IconChevronUp, IconExternalLink, IconReload, IconZoomReset } from "@tabler/icons-react";
import classes from "./species.module.css";
import { useDisclosure } from "@mantine/hooks";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any >
}

interface Occurrence {
    images: string[];
    videos: string[];
    sounds: string[];
}

interface Items {
    id: string;
    type: string;
}   

interface ActiveFacet {
    displayName: string
    name: string
    value: string
}

interface FacetResult {
    count: number
    fq: string
    i18nCode: string
    label: string
}

interface ActiveFacetObj {
    [key: string]: ActiveFacet[];
}

interface FacetResult {
    fieldName: string
    fieldResult: FacetResult[]
}

function ImagesView({result}: MapViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    // const [activeFacets, setActiveFacets] = useState<ActiveFacetObj>({});
    // field-agnostic filters
    const [facetResults, setFacetResults] = useState<FacetResult[]>([]); // from `facetResults` in the JSON response (unfilterded)
    const [activeFacets, setActiveFacets] = useState<ActiveFacetObj>({}); // from `activeFacetObj` in the JSON response (filterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<string[]>([]); // from user interaction with the checkboxes

    const [page, setPage] = useState<number>(0);
    const [type, setType] = useState<string>('all');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
    // const [includeOccurrences, setIncludeOccurrences] = useState(true);
    // const [includeSpecimens, setIncludeSpecimens] = useState(true);
    const [occurrenceCount, setOccurrenceCount] = useState(0);
    const [loading, setLoading] = useState(false);
    // Control of modal for image details
    const [openModalId, setOpenModalId] = useState<string | null>(null);
    const [opened, { open, close }] = useDisclosure(false);
    // Control of expand/collapse state for facets display
    const [expandCollapseState, setExpandCollapseState] = useState({
        license: false,
        dataResourceName: false,
        basisOfRecord: false 
    });
    const toggleExpandCollapse = (facet: keyof typeof expandCollapseState) => {
        setExpandCollapseState(prevState => ({
            ...prevState,
            [facet]: !prevState[facet]
        }));
    };

    const facetFields = ['basisOfRecord', 'multimedia', 'license', 'dataResourceName']; // TODO: move to config?
    const pageSize = 10;
    const biocacheBaseUrl = "https://biocache-ws.ala.org.au/ws"; // import.meta.env.VITE_APP_BIOCACHE_URL;
    // const imagesBaseUrl = "https://images.ala.org.au"; // import.meta.env.VITE_APP_IMAGE_BASE_URL;
    const maxVisibleFacets = 4;

    // useEffect(() => {
    //     fetchImages(true);
    // }, [result, page, sortDir, includeOccurrences, includeSpecimens, type, licenceTypeActive]);

    useEffect(() => {
        fetchImages(true); // fetch images with user filters
        fetchImages(false); // fetch facet results for unfiltered query
    }, [result, page, sortDir, fqUserTrigged, type]);
    
    function fetchImages(includeUserFq: boolean = true) {
        if (!result?.guid) {
            return;
        }

        // console.log("fetchImages", includeUserFq, fqUserTrigged);

        const typeFqMap: Record<PropertyKey, string> = {
            all: "&fq=multimedia:*",
            image: "&fq=multimedia:Image",
            video: "&fq=multimedia:Video",
            sound: "&fq=multimedia:Sound"
        };

        const facets = `&facets=${facetFields.join(',')}`; 
        // let typeFq = '';
        let userFq = '';
        const pageSizeRequest = includeUserFq ? pageSize : 0;
        const typeFq = typeFqMap[type] || '';
        
        if (includeUserFq) {
            
            userFq = fqUserTrigged.map(fq => `&fq=-${fq}`).join('');
            // licenseFq = buildLicenseFqs();
        } 

        let specimenFq = '';
        // if (!fqUserTrigged.includes('basisOfRecord')) {
        //     specimenFq = '&fq=(-typeStatus:*%20AND%20-basisOfRecord:PreservedSpecimen%20AND%20-identificationQualifier:"Uncertain"%20AND%20spatiallyValid:true%20AND%20-userAssertions:50001%20AND%20-userAssertions:50005)%20OR%20(basisOfRecord:PreservedSpecimen%20AND%20-typeStatus:*)'
        // } else if (fqUserTrigged.includes('basisOfRecord') && fqUserTrigged.includes('PreservedSpecimen')) {
            
        //     specimenFq = '&fq=basisOfRecord:PreservedSpecimen&fq=-typeStatus:*'
        // } else if (fqUserTrigged.includes('basisOfRecord') && !fqUserTrigged.includes('PreservedSpecimen')) {
            
        //     specimenFq = '&fq=-typeStatus:*&fq=-basisOfRecord:PreservedSpecimen&fq=-identificationQualifier:"Uncertain"&fq=spatiallyValid:true&fq=-userAssertions:50001&fq=-userAssertions:50005'
        // } else {
        //     setItems([]);
        // }
        // setLicenceType([]);
        const mediaFilter = '&qualityProfile=ALA&fq=-(duplicateStatus:ASSOCIATED%20AND%20duplicateType:DIFFERENT_DATASET)'
        // const licenseFq = buildLicenseFqs
        setLoading(true);
        fetch(biocacheBaseUrl + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            facets +
            '&start=' + (page * pageSize) +
            '&pageSize=' + pageSizeRequest +
            '&dir=' + sortDir +
            '&sort=eventDate' +
            '&fq=' + facetFields.join(":*&fq=") + ":*" + // default include all values for the facet fields
            userFq +
            specimenFq +
            typeFq +
            mediaFilter
            // licenseFq +
            // mediaFilter
        )
            .then(response => response.json())
            .then(data => {
                const list: { id: string, type: string }[] = [];
                data.occurrences.map((item: Occurrence) => {
                    if (item.images && (type === 'all' || type === 'image')) {
                        // for (let id of item.images) {
                        //     list.push({id: id, type: 'image'});
                        // }
                        list.push({id: item.images[0], type: 'image'});
                    }
                    if (item.videos && (type === 'all' || type === 'video')) {
                        // for (let id of item.videos) {
                        //     list.push({id: id, type: 'video'});
                        // }
                        list.push({id: item.videos[0], type: 'video'});
                    }
                    if (item.sounds && (type === 'all' || type === 'sound')) {
                        // for (let id of item.sound) {
                        //     list.push({id: id, type: 'sound'});
                        // }
                        list.push({id: item.sounds[0], type: 'sound'});
                    }
                })

                if (includeUserFq) {
                    setActiveFacets(data.activeFacetObj);

                    if (page == 0) {
                        setItems(list);
                        setOccurrenceCount(data.totalRecords);
                    } else {
                        setItems([...items, ...list]);
                    }
                } else {
                    // setFqResultsAll(data.activeFacetObj);
                    setFacetResults(data.facetResults);
                }

            }).catch(error => {
                console.error('Failed to fetch images - ' + error);
            }).finally(() => {
                setLoading(false);
            });

            // console.log("fqs", fqResults, fqResultsAll, includeUserFq);
    }

    const getImageThumbnailUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL}${id}`;
    }

    const getImageOriginalUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/proxyImage?imageId=${id}`;
    }

    function resetView() {
        setPage(0);
    }

    const handleImageError = (idx: number, e: any) => {
        // console.log('Image error', e.target?.src, idx);
        setItems(prevItems => prevItems.filter((_, index) => index !== idx));
    };

    const facetIsActive = useCallback((facetName: string, facetValue: string) : boolean => {
        // console.log("facetIsActive", facetName, facetValue, fqResults[`-${facetName}`]);
        // const facetValues = fqResults[`-${facetName}`]?.map((facet: ActiveFacet) => facet.value.split(':').pop());
        // const facetIsRemoved = facetValues?.some(value => removeQuotes(value || '') === facetValue);
        const facetIsRemoved = activeFacets[`-${facetName}`]?.some(fq => fq.value.substring(1,) === facetValue);
        return !facetIsRemoved; // if its removed, then its not active
    }, [activeFacets]);

    const getFieldResults = useCallback((name: string) : FacetResult[] => {
        return facetResults.filter(facet => facet.fieldName === name).map(facet => facet.fieldResult)[0];
    }, [facetResults]);

    // Modal event handlers
    const handleOpenModal = (id: string) => {
        setOpenModalId(id);
        open();
    };
    
    const handleCloseModal = () => {
        setOpenModalId(null);
        close();
    };

    const FilterCheckBoxGroup = ({ fieldName, limit = maxVisibleFacets }: { fieldName: string, limit?: number }) => {
        const updateUserFqs = (fq: string, active: boolean) => {
            resetView();
            active 
                ? setFqUserTrigged(prevState => {
                    // prevent duplicates (usually only happens in dev mode)
                    const newSet = new Set([...prevState, fq]);
                    return Array.from(newSet);
                    })
                : setFqUserTrigged(fqUserTrigged.filter(filter => filter !== fq));
        }  ;
        
        return (
            <>
                {getFieldResults(fieldName)?.map((item, idx) => 
                    <Collapse in={idx < limit || expandCollapseState[fieldName as keyof typeof expandCollapseState]} key={idx}>
                        <Checkbox 
                            size="xs"
                            checked={facetIsActive(fieldName, item.fq)}
                            onChange={() => { updateUserFqs(item.fq, facetIsActive(fieldName, item.fq))}}
                            label={<>
                                {item.label}
                                <Badge 
                                    variant="light" 
                                    color="rgba(100, 100, 100, 1)" 
                                    ml={8} pt={2} pr={8} pl={8} 
                                    radius="lg"
                                >{item.count}</Badge>
                            </>}
                        />
                    </Collapse>
                )}
                {getFieldResults(fieldName)?.length > limit &&
                    <Anchor 
                        onClick={() => toggleExpandCollapse(fieldName as keyof typeof expandCollapseState)} 
                        mt={5} 
                        style={{ width: '80%', display: 'block', textAlign: 'center'}}
                    >
                        {expandCollapseState[fieldName as keyof typeof expandCollapseState] 
                            ? <IconChevronUp /> 
                            : <IconChevronDown />
                        }
                    </Anchor>
                }
            </>
        );
    }; 

    return (
        <Box>
            <Flex gap="md" mt="md" direction={{ base: 'column', sm: 'row' }}>
                <Button variant={type === 'all'   ? 'filled' : 'outline'} onClick={() => {resetView();setType('all')}}>View all</Button>
                <Button variant={type === 'image' ? 'filled' : 'outline'} onClick={() => {resetView();setType('image')}}>Images</Button>
                <Button variant={type === 'sound' ? 'filled' : 'outline'} onClick={() => {resetView();setType('sound')}}>Sounds</Button>
                <Button variant={type === 'video' ? 'filled' : 'outline'} onClick={() => {resetView();setType('video')}}>Videos</Button>
            </Flex>
            <Text mt="lg" mb="md" size="sm" fw="bold">
                Showing {occurrenceCount > 0 ? (occurrenceCount < pageSize ? occurrenceCount : (page+1)*pageSize) : 0} {' '}
                of {occurrenceCount} results.{' '}
                <Anchor 
                    href={`https://biocache.ala.org.au/occurrences/search?q=lsid:${result?.guid}&fq=multimedia:*#tab_recordImages`}
                    target="_blanks"
                    inherit
                >View all results on ALA occurrence explorer</Anchor>
            </Text>
            <Grid>
                <Grid.Col span={{ base: 12, md: 9, lg: 9 }}>
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
                                    <>
                                        <UnstyledButton onClick={() => handleOpenModal(item.id)}>
                                            <Image 
                                                radius="md" 
                                                h={210}
                                                maw={260}
                                                src={ getImageThumbnailUrl(item.id) }
                                                onError={(e) => handleImageError(idx, e)}
                                            />
                                        </UnstyledButton>
                                        <Modal
                                            opened={opened && openModalId === item.id}
                                            onClose={handleCloseModal}
                                            size="auto"
                                            title={ <Anchor 
                                                    display="block" 
                                                    target="_blank"
                                                    ml={5}
                                                    fw="bold"
                                                    mt="xs"
                                                    size="md"
                                                    href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${item.id}`}
                                                >View image file details <IconExternalLink size={20}/></Anchor>}
                                        >
                                            <Image 
                                                radius="md" 
                                                src={ getImageOriginalUrl(item.id) }
                                            />
                                        </Modal>
                                    </>}
                                {item.type === 'sound' && 
                                    <Flex maw={240} justify="center" align="center" direction="column">
                                        <audio key={idx} controls preload="auto">
                                            {/* https://images.ala.org.au/proxyImage?imageId=9464cc88-4347-4ba8-aa1e-b4766e926d47 */}
                                            <source 
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${item.id}`} 
                                                type="audio/mpeg" 
                                            />
                                        </audio>
                                        <Anchor 
                                            display="block" 
                                            target="_blank"
                                            mt="xs"
                                            size="sm"
                                            href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${item.id}`}
                                        >Sound file details</Anchor>
                                    </Flex>
                                }
                                {item.type === 'video' && 
                                    <Flex maw={240} justify="center" align="center" direction="column">
                                        <video key={idx} controls preload="auto">
                                            {/* https://images.ala.org.au/proxyImage?imageId=9464cc88-4347-4ba8-aa1e-b4766e926d47 */}
                                            <source 
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${item.id}`} 
                                                type="video/mp4" 
                                            />
                                        </video>
                                        <Anchor 
                                            display="block" 
                                            target="_blank"
                                            size="sm"
                                            mt="xs"
                                            href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${item.id}`}
                                        >Video file details</Anchor>
                                    </Flex>
                                }
                            </Flex>
                        )}
                        { loading && 
                            [...Array(10)].map((_ , idx) => 
                                <Box key={idx} w={260} h={210}>
                                    <Skeleton height="100%" width="100%" radius="md" />
                                </Box>
                            )
                        }
                    </Flex>
                    {items && items.length > 0 &&
                        <Flex justify="center" align="center">
                            <Button 
                                mt="lg" 
                                variant="default" 
                                radius="xl"
                                pr={40}
                                pl={50}
                                onClick={() => setPage(page + 1)}
                                disabled={(page + 1) * pageSize >= occurrenceCount}
                                rightSection={<IconChevronDown />}
                            >Load more</Button>
                        </Flex>
                        }
                </Grid.Col>
                <Grid.Col span={3} className={classes.hideMobile}>
                    <Flex justify="flex-start" align="center" gap="sm">
                        <IconAdjustmentsHorizontal />
                        <Text fw="bold">Refine view</Text>
                    </Flex>
                    <Divider mt="lg" mb="lg" />
                    <Radio.Group 
                        classNames={{ label: classes.gallerySortLabel }}
                        value={sortDir}
                        onChange={(value: string) => setSortDir(value as 'desc' | 'asc')}
                        label="Sort by"
                    >
                        <Radio size="xs" value="desc"
                            label="Latest" />
                        <Radio size="xs"  value="asc"
                            label="Oldest" />
                    </Radio.Group>
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="md">Record type</Text>
                    <FilterCheckBoxGroup fieldName="basisOfRecord" limit={5}/>
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="md">Licence type</Text>
                    <FilterCheckBoxGroup fieldName="license" />
                    <Divider mt="sm" mb="lg" />

                    <Text fw="bold" mb="md">Dataset</Text>
                    <FilterCheckBoxGroup fieldName="dataResourceName" />
                    
                    <Button 
                        mt="lg" 
                        variant="default" 
                        radius="xl"
                        fullWidth
                        onClick={() => {
                            resetView();
                            setFqUserTrigged([]);
                        }}
                        disabled={fqUserTrigged.length === 0}
                        rightSection={<IconZoomReset />}>Reset</Button>
                </Grid.Col>
            </Grid>
        </Box>
    );
}

export default ImagesView;