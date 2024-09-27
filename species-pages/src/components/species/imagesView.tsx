import { useCallback, useEffect, useState } from "react";
import { Anchor, Badge, Box, Button, Checkbox, Collapse, Divider, Flex, Grid, Image, Modal, Radio, Skeleton, Text, UnstyledButton } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconChevronDown, IconChevronUp, IconExternalLink, IconZoomReset } from "@tabler/icons-react";
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

interface UserFq {
    [key: string]: string[];
}

function ImagesView({result}: MapViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    // field-agnostic filters
    const [facetResults, setFacetResults] = useState<FacetResult[]>([]); // from `facetResults` in the JSON response (unfilterded)
    const [facetResultsFiltered, setFacetResultsFiltered] = useState<FacetResult[]>([]); // from `facetResults` in the JSON response (filterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<UserFq>({}); // from user interaction with the checkboxes

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
    const facetLimit = 15;
    const biocacheBaseUrl = "https://biocache-ws.ala.org.au/ws"; // import.meta.env.VITE_APP_BIOCACHE_URL;
    const maxVisibleFacets = 4;

    useEffect(() => {
        fetchImages(true); // fetch images with user filters
        fetchImages(false); // fetch facet results for unfiltered query
    }, [result, page, sortDir, fqUserTrigged, type]);
    
    function fetchImages(includeUserFq: boolean = true) {
        if (!result?.guid) {
            return;
        }

        const typeFqMap: Record<PropertyKey, string> = {
            all: "&fq=multimedia:*",
            image: "&fq=multimedia:Image",
            video: "&fq=multimedia:Video",
            sound: "&fq=multimedia:Sound"
        };

        // Function to transform fqUserTrigged into a fq string
        const transformFqUserTrigged = (): string => {
            const fqParts = Object.values(fqUserTrigged).map((values) => `&fq=${values.join("+OR+")}`);
            return fqParts.length > 0 ? fqParts.join("") : '';
        }

        const facets = `&facets=${facetFields.join(',')}`; 
        const pageSizeRequest = includeUserFq ? pageSize : 0;
        const typeFq = typeFqMap[type] || '';
        const userFq = includeUserFq ? transformFqUserTrigged() : '';

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
            '&flimit=' + facetLimit +
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
                    // The following `for` loops are commented out as it distorts the `counts`, due to
                    // multiple media files per record result in an indeterminate number of media files
                    // (i.e., ask for 10 get more than 10). So we take only the first file per record.
                    // TODO: Delete the `for` loops if we're sticking with Biocache API (vs using image-service API)
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
                    if (page == 0) {
                        setItems(list);
                        setOccurrenceCount(data.totalRecords);
                        setFacetResultsFiltered(data.facetResults);
                    } else {
                        setItems([...items, ...list]);
                    }
                } else {
                    setFacetResults(data.facetResults);
                }
            }).catch(error => {
                console.error('Failed to fetch images - ' + error);
            }).finally(() => {
                setLoading(false);
            });
    }

    const getImageThumbnailUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL}${id}`;
    }

    const getImageOriginalUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/proxyImage?imageId=${id}`;
    }

    function resetView() {
        setPage(0);
        setFqUserTrigged({});
    }

    // Remove image from list if it fails to load
    const handleImageError = (idx: number, _e: any) => {
        // console.log('Image error', _e.target?.src, idx);
        setItems(prevItems => prevItems.filter((_, index) => index !== idx));
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en').format(num);
    }

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

    // Bunch of methods to handle facet filtering - Rube Goldberg machine unfortunately

    // Check if a facet value is active (should be shown as checked)
    const fqValueIsActive = (facetName: string, facetValue: string) : boolean => {
        const fqTriggeredForField = fqUserTrigged[facetName];
        return (fqTriggeredForField) ? fqTriggeredForField?.includes(facetValue) : false;
    };

    const filteredCountIsZero = (fieldName: string, label: string): boolean => 
        getMinRecordCount(fieldName, label) > 0;
    

    // Get the minimum record count for a facet value by inspecting both facetResults and facetResultsFiltered
    const getMinRecordCount = (fieldName: string, label: string): number => 
        facetResultsFiltered.length === 0 
            ? facetResults?.filter(facet => facet.fieldName === fieldName).map(facet => facet.fieldResult)[0]?.filter(it=>it.label===label)?.[0]?.count || 0
            : facetResultsFiltered?.filter(facet => facet.fieldName === fieldName).map(facet => facet.fieldResult)[0]?.filter(it=>it.label===label)?.[0]?.count || 0;
    

    // Check if a facet will show zero results if clicked (should be shown as disabled)
    // If only one checkbox is active in a group and no other groups, then the checkbox should be enabled (OR logic)
    // If multiple checkboxes are active in multiple groups, then only non-zero facetResults are active (AND logic)
    // TODO: Potentially confusing for users, might need to be rethought
    const fqValueIsDisabled = (facetName: string, facetValue: string, fqValue: string): boolean => {
        const isChecked = fqValueIsActive(facetName, fqValue);
        const isZero = filteredCountIsZero(facetName, facetValue);
        const onlyOneFilterActiveInSameGroup = Object.keys(fqUserTrigged).filter(key => key !== facetName).every(key => fqUserTrigged[key].length === 0);   
        // console.log('fqValueIsDisabled', facetName, facetValue, isChecked, isZero, onlyOneFilterActiveInSameGroup);
        return !isChecked && !isZero && !onlyOneFilterActiveInSameGroup;
    }

    // Checkbox group reusable component
    const FilterCheckBoxGroup = ({ fieldName, limit = maxVisibleFacets }: { fieldName: string, limit?: number }) => {
        // anonymous method to update the fqUserTrigged state
        const updateUserFqs = (fq: string, active: boolean) => {
            setPage(0);
            !active 
                ? setFqUserTrigged(prevState => {
                    const newFq = { ...prevState };
                    newFq[fieldName] = [...(newFq[fieldName] || []), fq];
                    return newFq;
                })
                : setFqUserTrigged(prevState => {
                    const newFq = { ...prevState };
                    newFq[fieldName] = newFq[fieldName]?.filter(filter => filter !== fq);
                    return newFq;
                });
        };

        // Get the display count for a facet value - if a filter is active, then may be 2 values - total and filtered
        // TODO: Potentially confusing for users, might need to be rethought
        const getDisplayCount = (fieldName: string, label: string, count: number): string => {
            const onlyOneFilterActiveInSameGroup = Object.keys(fqUserTrigged).filter(key => key !== fieldName).every(key => fqUserTrigged[key].length === 0);    
            return count == getMinRecordCount(fieldName, label) || onlyOneFilterActiveInSameGroup 
                ? count.toString() 
                : `${count} / ${getMinRecordCount(fieldName, label)}`;
        }
        
        return (
            <>
                {getFieldResults(fieldName)?.map((item, idx) => 
                    <Collapse in={idx < limit || expandCollapseState[fieldName as keyof typeof expandCollapseState]} key={idx}>
                        <Checkbox 
                            size="xs"
                            // turned off for now, as we can't providing accurate counts for each facet value, once filtering is applied
                            // disabled={fqValueIsDisabled(fieldName, item.label, item.fq)}
                            checked={fqValueIsActive(fieldName, item.fq)}
                            onChange={() => { updateUserFqs(item.fq, fqValueIsActive(fieldName, item.fq))}}
                            label={<>
                                <Text span c={fqValueIsDisabled(fieldName, item.label, item.fq) && false ? 'gray' : 'default'}>{item.label}</Text>
                                <Badge 
                                    variant="light" 
                                    color="rgba(100, 100, 100, 1)" 
                                    ml={8} pt={2} pr={8} pl={8} 
                                    radius="lg"
                                >{getDisplayCount(fieldName, item.label, item.count)}</Badge>
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
            <Text mt="lg" mb="md" size="md" fw="bold">
                Showing {occurrenceCount > 0 ? (occurrenceCount < (page+1)*pageSize ? occurrenceCount : (page+1)*pageSize) : 0} {' '}
                of {formatNumber(occurrenceCount)} results.{' '}
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
                                    <Flex maw={240} h={200} justify="center" align="center" direction="column">
                                        <audio key={idx} controls preload="auto" style={{ maxWidth: '240px'}}>
                                            <source 
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${item.id}`} 
                                                type="audio/mpeg" 
                                                width={240}
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
                                    <Flex maw={240} h={200} justify="center" align="center" direction="column">
                                        <video key={idx} controls preload="auto" style={{ maxWidth: '240px', maxHeight: '170px'}}>
                                            <source 
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${item.id}`} 
                                                height={200}
                                                width={240}
                                                // Magpie examples use "video/3gpp" but hard-coding this still does not show the video content, just sound.
                                                // Update: Confirming the 2 Magpie examples do not contain video content, just sound.
                                                // Platypus page does contain video content, which plays in place.
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
                            >View more</Button>
                        </Flex>
                        }
                </Grid.Col>
                <Grid.Col span={3} className={classes.hideMobile}>
                    <Flex justify="flex-start" align="center" gap="sm">
                        <IconAdjustmentsHorizontal />
                        <Text fw="bold">Refine view</Text>
                    </Flex>
                    <Divider mt="lg" mb="lg" />
                    
                    <Text fw="bold" mb="sm">Sort by</Text>
                    <Radio.Group 
                        classNames={{ label: classes.gallerySortLabel }}
                        value={sortDir}
                        onChange={(value: string) => { 
                            resetView(); 
                            setSortDir(value as 'desc' | 'asc')
                        }}
                        // label="Sort by"
                    >
                        <Radio size="xs" value="desc"
                            label="Latest" />
                        <Radio size="xs"  value="asc"
                            label="Oldest" />
                    </Radio.Group>
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="sm">Record type</Text>
                    <FilterCheckBoxGroup fieldName="basisOfRecord" limit={5}/>
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="sm">Licence type</Text>
                    <FilterCheckBoxGroup fieldName="license" />
                    <Divider mt="sm" mb="lg" />

                    <Text fw="bold" mb="sm">Dataset</Text>
                    <FilterCheckBoxGroup fieldName="dataResourceName" />
                    
                    <Button 
                        mt="lg" 
                        variant="default" 
                        radius="xl"
                        fullWidth
                        onClick={() => {
                            resetView();
                            setFqUserTrigged({});
                        }}
                        disabled={Object.keys(fqUserTrigged).length === 0}
                        rightSection={<IconZoomReset />}>Reset</Button>
                </Grid.Col>
            </Grid>
        </Box>
    );
}

export default ImagesView;