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

interface FacetResultSet {
    fieldName: string
    fieldResult: FacetResult[]
}

interface UserFq {
    [key: string]: string[];
}

const fieldMapping = {
    basisOfRecord: {
        'Human observation': 'Occurrences',
        'Machine observation': 'Occurrences',
        'Preserved specimen': 'Specimens',
        'Fossil specimen': 'Specimens',
        'Living specimen': 'Specimens',
        'Material sample': 'Specimens',
        'Observation': 'Occurrences',
        'Occurrence': 'Occurrences',
        'Not supplied': 'Occurrences'
    },
    license: {  // by	by-nc	by-nc-nd	by-nc-sa	by-nd	by-sa 0
        'CC0': 'CC0',
        'CC-BY 4.0 (Int)': 'CC-BY',
        'CC-BY-NC': 'CC-BY-NC',
        'CC-BY': 'CC-BY',
        'CC-BY-NC 4.0 (Int)': 'CC-BY-NC',
        'CC-BY 3.0 (Au)': 'CC-BY',
        'CC-BY-Int': 'CC-BY',
        'CC-BY 3.0 (Int)': 'CC-BY',
        'CC-BY-NC 3.0 (Au)': 'CC-BY-NC',
        'CC-BY 4.0 (Au)': 'CC-BY',
        'CC-BY-SA 4.0 (Int)': 'CC-BY-SA',
        'CC-BY-NC-SA 4.0 (Int)': 'CC-BY-NC-SA',
        'Creative Commons - license at record level': 'Creative Commons - license at record level',
        'CC-BY-NC-ND 4.0 (Int)': 'CC-BY-NC-ND',
        'CC-BY 3.0 (NZ)': 'CC-BY',
        // 'Not supplied': 'Not supplied',
    }
};

// Started implementing links for license types, too fiddly for now (needs mapping to separate URLs for each license type)
const fieldLink: Record<string, string[]> = {
    'license-XXX': ['https://creativecommons.org/licenses/','/4.0/deed.en'],
}

function ImagesView({result}: MapViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    const [facetResults, setFacetResults] = useState<FacetResultSet[]>([]); // from `facetResults` in the JSON response (unfilterded)
    const [facetResultsFiltered, setFacetResultsFiltered] = useState<FacetResultSet[]>([]); // from `facetResults` in the JSON response (filterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<UserFq>({}); // from user interaction with the checkboxes
    const [page, setPage] = useState<number>(0);
    const [type, setType] = useState<string>('all'); // image, video, sound
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
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
    const maxVisibleFacets = 4;
    const biocacheBaseUrl = "https://biocache-ws.ala.org.au/ws"; // import.meta.env.VITE_APP_BIOCACHE_URL;

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

    
        // if (includeUserFq) {
        //     if (includeSpecimens && includeOccurrences) {
        //         console.log("includeSpecimens && includeOccurrences");
        //         // specimenFq = '&fq=(-typeStatus:*%20AND%20-basisOfRecord:PreservedSpecimen%20AND%20-identificationQualifier:"Uncertain"%20AND%20spatiallyValid:true%20AND%20-userAssertions:50001%20AND%20-userAssertions:50005)%20OR%20(basisOfRecord:PreservedSpecimen%20AND%20-typeStatus:*)'
        //     } else if (includeSpecimens) {
        //         specimenFq = '&fq=basisOfRecord:PreservedSpecimen&fq=-typeStatus:*'
        //     } else if (includeOccurrences) {
        //         specimenFq = '&fq=-typeStatus:*&fq=-basisOfRecord:PreservedSpecimen&fq=-identificationQualifier:"Uncertain"&fq=spatiallyValid:true&fq=-userAssertions:50001&fq=-userAssertions:50005'
        //     } else {
        //         // setItems([]);
        //         specimenFq = ''
        //     }
        // } else {
        //     specimenFq = '&fq=(-typeStatus:*%20AND%20-basisOfRecord:PreservedSpecimen%20AND%20-identificationQualifier:"Uncertain"%20AND%20spatiallyValid:true%20AND%20-userAssertions:50001%20AND%20-userAssertions:50005)%20OR%20(basisOfRecord:PreservedSpecimen%20AND%20-typeStatus:*)'
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

    // Helper to invert a Record<string, string> object to Record<string, string[]>  
    // E.g., `{a: 'b', 'c': 'b', 'd': 'e'} -> {b: ['a','c'], d: ['e']}`
    function invertObject(obj: Record<string, string>): Record<string, string[]> {
        return Object.fromEntries(
            Object.entries(obj).reduce((acc, [key, value]) => {
                if (!acc.has(value)) {
                    acc.set(value, []);
                }
                acc.get(value).push(key);
                return acc;
            }, new Map())
        );
    }

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
    };

    // Checkbox group reusable component
    const FilterCheckBoxGroup = ({ fieldName, limit = maxVisibleFacets, grouped = false }: { fieldName: string, limit?: number, grouped?: boolean }) => {
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

        let fieldsToDisplay: FacetResult[] = getFieldResults(fieldName);

        if (grouped) {
            // If the field is grouped, then we need to create synthetic entries based on the fieldMapping
            const typeMap = fieldMapping[fieldName as keyof typeof fieldMapping] || {}; // e.g. {'Machine observation': 'Occurrences', 'Preserved specimen': 'Specimens', ...}
            const invertedTypeMap = invertObject(typeMap); // e.g. {'Occurrences': ['Machine observation','Observation, ...], 'Specimens': ['Preserved specimen','Material sample', ...]}
            const syntheticFields: FacetResult[] = Object.entries(invertedTypeMap).map(([key, values]:[string, string[]]) => {
                
                const totalCount: number = fieldsToDisplay?.filter(field => values.includes(field.label)).reduce((acc, field) => acc + field.count, 0);
                const fq: string = fieldsToDisplay
                    ?.filter(field => values.includes(field.label))
                    .map(field => field.fq)
                    .join('+OR+');
                return { label: key, count: totalCount, fq: fq, i18nCode: '' };
            });

            fieldsToDisplay = syntheticFields.sort((a, b) => b.count - a.count);
        } 

        // Get the display count for a facet value - if a filter is active, then may be 2 values - total and filtered
        // TODO: Potentially confusing for users, might need to be rethought
        // Not currently used -> delete if not needed
        const getDisplayCount = (fieldName: string, label: string, count: number): string => {
            const onlyOneFilterActiveInSameGroup = Object.keys(fqUserTrigged).filter(key => key !== fieldName).every(key => fqUserTrigged[key].length === 0);    
            // console.log('getDisplayCount', fieldName, label, count, onlyOneFilterActiveInSameGroup, getMinRecordCount(fieldName, label));
            return count == getMinRecordCount(fieldName, label) || onlyOneFilterActiveInSameGroup 
                ? count?.toString() 
                : `${count} / ${getMinRecordCount(fieldName, label)}`;
        }
        
        return (
            <>
                {fieldsToDisplay?.map((item, idx) => 
                    <Collapse in={idx < limit || expandCollapseState[fieldName as keyof typeof expandCollapseState]} key={idx}>
                        <Checkbox 
                            size="xs"
                            // turned off for now, as we can't providing accurate counts for each facet value, once filtering is applied
                            // disabled={fqValueIsDisabled(fieldName, item.label, item.fq)}
                            checked={fqValueIsActive(fieldName, item.fq)}
                            onChange={() => { updateUserFqs(item.fq, fqValueIsActive(fieldName, item.fq))}}
                            label={<>
                                <Text span c={fqValueIsDisabled(fieldName, item.label, item.fq) && false ? 'gray' : 'default'}>
                                { fieldLink[fieldName] 
                                    ? <Anchor href={`${fieldLink[fieldName][0]}${item.label.replace('CC-','')}${fieldLink[fieldName][1]}`} target="_blank">{item.label}</Anchor> 
                                    : item.label }
                                </Text>
                                <Badge 
                                    variant="light" 
                                    color="rgba(100, 100, 100, 1)" 
                                    ml={8} pt={2} pr={8} pl={8} 
                                    radius="lg"
                                >
                                    {/* {getDisplayCount(fieldName, item.label, item.count)} */}
                                    {formatNumber(item.count)}
                                </Badge>
                            </>}
                            styles={{ inner: { marginTop: 3} }}
                        />
                    </Collapse>
                )}
                {fieldsToDisplay?.length > limit &&
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
                    >
                        <Radio  
                            size="xs" 
                            value="desc" 
                            styles={{ inner: { marginTop: 2} }}
                            label="Latest" />
                        <Radio 
                            size="xs"  
                            value="asc"
                            styles={{ inner: { marginTop: 2} }}
                            label="Oldest" />
                    </Radio.Group>
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="sm">Record type</Text>
                    <FilterCheckBoxGroup fieldName="basisOfRecord" grouped={true} />
                    <Divider mt="lg" mb="lg" />

                    <Text fw="bold" mb="sm">Licence type</Text>
                    <FilterCheckBoxGroup fieldName="license" grouped={true} />
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