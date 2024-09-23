import { useCallback, useEffect, useState } from "react";
import { Anchor, Box, Button, Checkbox, Collapse, Divider, Flex, Grid, Image, Radio, Skeleton, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconChevronDown, IconChevronUp, IconReload } from "@tabler/icons-react";
import classes from "./species.module.css";
import { useDisclosure } from "@mantine/hooks";

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
    // const [facetResultsAll, setFacetResultsAll] = useState<FacetResult[]>([]); // from `facetResults` in the JSON response (filterded)
    const [fqResults, setFqResults] = useState<ActiveFacetObj>({}); // from `activeFacetObj` in the JSON response (filterded)
    // const [fqResultsAll, setFqResultsAll] = useState<ActiveFacetObj>({}); // from `activeFacetObj` in the JSON response (unfilterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<string[]>([]); // from user interaction (filterded)

    const [page, setPage] = useState<number>(0);
    const [type, setType] = useState<string>('all');
    const [sortDir, setSortDir] = useState('desc');
    // const [licenceType, setLicenceType] = useState<string[]>([]);
    // const [licenceTypeActive, setLicenceTypeActive] = useState<string[]>([]);
    const [includeOccurrences, setIncludeOccurrences] = useState(true);
    const [includeSpecimens, setIncludeSpecimens] = useState(true);
    const [occurrenceCount, setOccurrenceCount] = useState(0);
    const [loading, setLoading] = useState(false);
    // Control of expand/collapse state for facets display
    const [expandCollapseState, setExpandCollapseState] = useState({
        license: false,
        dataResourceName: false,
        basisOfRecord: false // Add more facets as needed
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
    const imagesBaseUrl = "https://images.ala.org.au"; // import.meta.env.VITE_APP_IMAGE_BASE_URL;
    const maxVisibleFacets = 4;

    // useEffect(() => {
    //     fetchImages(true);
    // }, [result, page, sortDir, includeOccurrences, includeSpecimens, type, licenceTypeActive]);

    useEffect(() => {
        fetchImages(true); // fetch images with user filters
        fetchImages(false); // fetch facet results for unfiltered query
    }, [result, page, sortDir, fqUserTrigged]);

    const buildLicenseFqs = () => {
        let fqString = '&fq=license:*';
        // TODO: filtering code goes here - should be field agnostic
        // if (licenceTypeActive.length > 0) {
        // } 
        // (licenceTypeActive.length > 0) ? `&fq=license:${licenceTypeActive.join('&fq=license:')}` : '&fq=license:*';
        return fqString
    }
    
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
        let typeFq = '';
        let userFq = '';
        let pageSizeRequest = pageSize;

        if (includeUserFq) {
            typeFq = typeFqMap[type] || '';
            userFq = fqUserTrigged.map(fq => `&fq=-${fq}`).join('');
            // licenseFq = buildLicenseFqs();
        } else {
            pageSizeRequest = 0; // only need the facet results
        }

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
        // setLicenceType([]);
        const mediaFilter = '&qualityProfile=ALA&fq=-(duplicateStatus:ASSOCIATED%20AND%20duplicateType:DIFFERENT_DATASET)'
        // const licenseFq = buildLicenseFqs
        setLoading(true);
        clearFacetValues();
        fetch(biocacheBaseUrl + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            facets +
            '&start=' + (page * pageSize) +
            '&pageSize=' + pageSizeRequest +
            '&dir=' + sortDir +
            '&sort=eventDate' +
            '&fq=' + facetFields.join(":*&fq=") + ":*" + // default include all values for the facet fields
            userFq 
            // typeFq +
            // specimenFq +
            // licenseFq +
            // mediaFilter
        )
            .then(response => response.json())
            .then(data => {
                const list: { id: string, type: string }[] = [];
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

                if (includeUserFq) {
                    setFqResults(data.activeFacetObj);
                    // setFacetResults(data.facetResults);

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

    const clearFacetValues = () => {
        // setLicenceType([]);
        // setActiveFacets({});
        setFacetResults([]);
        setFqResults({});
        // setFqResultsAll({});
        // setLicenceTypeActive([]);
        // setDataResources([]);
    }

    const getImageUrl = (id: string) => {
        return `${imagesBaseUrl}/image/proxyImageThumbnail?imageId=${id}`;
    }

    function resetView() {
        setPage(0);
    }

    const handleImageError = (idx: number, e: any) => {
        // console.log('Image error', e.target?.src, idx);
        setItems(prevItems => prevItems.filter((_, index) => index !== idx));
    };

    const removeQuotes = (str: string): string => {
        // Regular expression to match leading and trailing quotes
        return str.replace(/^["']+|["']+$/g, '');
    };
    

    const facetIsActive = useCallback((facetName: string, facetValue: string) : boolean => {
        // const facetValue: string = activeFacets?.[name]?.[0]?.value || '';
        // return facetValue.includes(value) || facetValue.endsWith('*');
        // assume its active unless there is a negative fq set for it
        // facet.value will be in the format `fieldName:value`, e.g. `license:CC-BY`
        // const facetIsRemoved = fqResults[`-${facetName}`]?.some((facet: ActiveFacet) => facet?.value?.split(':')?.pop()?.includes(facetValue));
        const facetValues = fqResults[`-${facetName}`]?.map((facet: ActiveFacet) => facet.value.split(':').pop());
        // const facetIsRemoved = removeQuotes(facetValues?.[0] || '') === facetValue;
        const facetIsRemoved = facetValues?.some(value => removeQuotes(value || '') === facetValue);
        // console.log("facetIsActive", facetName, facetValue, facetValues, facetIsRemoved);
        return !facetIsRemoved; // if its removed, then its not active
    }, [fqResults]);

    const getFieldResults = useCallback((name: string) : FacetResult[] => {
        return facetResults.filter(facet => facet.fieldName === name).map(facet => facet.fieldResult)[0];
    }, [facetResults]);

    const updateUserFqs = (name: string, value: string, active: boolean) => {
        active 
            ? setFqUserTrigged([...fqUserTrigged, `${name}:"${encodeURIComponent(value)}"`])
            : setFqUserTrigged(fqUserTrigged.filter(fq => fq !== `${name}:"${encodeURIComponent(value)}"`));
    }

    const FilterCheckBoxGroup = ({ fieldName, limit = maxVisibleFacets }: { fieldName: string, limit?: number }) => {
        return (
            <>
                {getFieldResults(fieldName)?.map((item, idx) => 
                    <Collapse in={idx < limit || expandCollapseState[fieldName as keyof typeof expandCollapseState]} key={idx}>
                        <Checkbox 
                            size="xs"
                            checked={facetIsActive(fieldName, item.label)}
                            onChange={() => { updateUserFqs(fieldName, item.label, facetIsActive(fieldName, item.label))}}
                            label={`${item.label} (${item.count})`} 
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
                <Button variant={type === 'all' ? 'filled' : 'outline'} onClick={() => {resetView();setType('all')}}>View all</Button>
                <Button variant={type === 'image' ? 'filled' : 'outline'} onClick={() => {resetView();setType('image')}}>Images</Button>
                <Button variant={type === 'sound' ? 'filled' : 'outline'} onClick={() => {resetView();setType('sound')}}>Sounds</Button>
                <Button variant={type === 'video' ? 'filled' : 'outline'} onClick={() => {resetView();setType('video')}}>Videos</Button>
            </Flex>
            <Text mt="lg" mb="md" size="sm" fw="bold">
                Showing {occurrenceCount > 0 ? (page+1)*pageSize : 0} of {occurrenceCount} results ({items.length})
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
                                    <Image 
                                        radius="md" 
                                        h={210}
                                        maw={260}
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
                                <Box key={idx} w={260} h={210}>
                                    <Skeleton height="100%" width="100%" radius="md" />
                                </Box>
                            )
                        }
                    </Flex>
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
                    <FilterCheckBoxGroup fieldName="basisOfRecord" limit={5}/>
                    <Divider mt="lg" mb="lg" />
                    <Text fw="bold" mb="md">Licence type</Text>
                    <FilterCheckBoxGroup fieldName="license" />
                    <Divider mt="sm" mb="lg" />
                    <Text fw="bold" mb="md">Institution</Text>
                    <FilterCheckBoxGroup fieldName="dataResourceName" />
                    
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