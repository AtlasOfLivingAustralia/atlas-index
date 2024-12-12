import { useCallback, useEffect, useState } from "react";
import { Anchor, Badge, Box, Button, Checkbox, Collapse, Divider, Flex, Grid, Image, Modal, Radio, Skeleton, Text, UnstyledButton } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconChevronDown, IconChevronUp, IconExternalLink, IconMovie, IconVolume, IconZoomReset } from "@tabler/icons-react";
import classes from "./species.module.css";
import { useDisclosure } from "@mantine/hooks";
import capitalizeFirstLetter from "../../helpers/Capitalise";

interface MediaViewProps {
    result?: Record<PropertyKey, string | number | any >
}

interface MediaTypes {
    images: string[];
    videos: string[];
    sounds: string[];
}

interface Items {
    id: string;
    type: string;
}

interface FacetResult {
    count: number
    fq: string
    i18nCode: string
    label: string
}

interface FacetResultSet {
    fieldName: string
    fieldResult: FacetResult[]
}

interface UserFq {
    [key: string]: string[];
}

enum MediaTypeEnum {
    all = 'all',
    image = 'image',
    video = 'video',
    sound = 'sound'
}

type MediaTypeValues = keyof typeof MediaTypeEnum;

// "Grouped" filters require a mapping for the values to be grouped together
const fieldMapping = {
    basisOfRecord: {
        'Human observation': 'Observations',
        'Machine observation': 'Observations',
        'Preserved specimen': 'Specimens',
        'Fossil specimen': 'Specimens',
        'Living specimen': 'Specimens',
        'Material sample': 'Specimens',
        'Observation': 'Observations',
        'Occurrence': 'Observations',
        'Not supplied': 'Observations'
    },
    license: {
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
const facetFields = ['basisOfRecord', 'multimedia', 'license', 'dataResourceName']; // TODO: move to config?

// Started implementing links for license types, too fiddly for now (needs mapping to separate URLs for each license type)
const fieldLink: Record<string, string[]> = {
    'license-XXX': ['https://creativecommons.org/licenses/','/4.0/deed.en'],
}

function ImagesView({result}: MediaViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    const [facetResults, setFacetResults] = useState<FacetResultSet[]>([]); // from `facetResults` in the JSON response (unfilterded)
    const [filteredFacetResults, setFilteredFacetResults] = useState<FacetResultSet[]>([]);  // from `facetResults` in the JSON response (filterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<UserFq>({}); // from user interaction with the checkboxes
    const [page, setPage] = useState(0); // Note: not `start` but page number: 0, 1, 2, ...
    const [mediaType, setMediaType] = useState<MediaTypeValues>('all'); // all, image, video, sound
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

    const pageSize = 10;
    const facetLimit = 15;
    const maxVisibleFacets = 4;
    const gridHeight = 210;
    const gridWidthTypical = 240;
    const biocacheBaseUrl = import.meta.env.VITE_APP_BIOCACHE_URL;
    const mediaFqMap: Record<MediaTypeValues, string> = {
        all: "&fq=multimedia:*",
        image: "&fq=multimedia:Image",
        sound: "&fq=multimedia:Sound",
        video: "&fq=multimedia:Video",
    };

    useEffect(() => {
        fetchImages(true); // fetch images with user filters
        fetchImages(false); // fetch facet results for unfiltered query
    }, [result, page, sortDir, fqUserTrigged, mediaType]);

    function fetchImages(includeUserFq: boolean = true) {
        if (!result?.guid) {
            return;
        }

        // Function to transform fqUserTrigged into a fq string
        const transformFqUserTrigged = (): string => {
            const fqParts = Object.values(fqUserTrigged).map((values) => `&fq=${values.join("+OR+")}`);
            return fqParts.length > 0 ? fqParts.join("") : '';
        }

        const facets = `&facets=${facetFields.join(',')}`;
        const pageSizeRequest = includeUserFq ? pageSize : 0;
        const mediaFq = mediaFqMap[mediaType] || '&fq=multimedia:*';
        const userFq = includeUserFq ? transformFqUserTrigged() : '';

        setLoading(true);
        fetch(biocacheBaseUrl + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            facets +
            '&start=' + (page * pageSize) +
            '&pageSize=' + pageSizeRequest +
            '&dir=' + sortDir +
            '&sort=eventDate' +
            '&qualityProfile=ALA' +
            '&flimit=' + facetLimit +
            userFq +
            mediaFq
        )
            .then(response => response.json())
            .then(data => {
                const list: { id: string, type: string }[] = [];
                data.occurrences.map((item: MediaTypes) => {
                    // The following `for` loops are commented out as it distorts the `counts`, due to
                    // multiple media files per record result in an indeterminate number of media files
                    // (i.e., ask for 10 get more than 10). So we take only the first file per record.
                    // TODO: Delete the `for` loops if we're sticking with Biocache API (vs using image-service API)
                    if (item.images && (mediaType === MediaTypeEnum.all || mediaType === MediaTypeEnum.image)) {
                        // for (let id of item.images) {
                        //     list.push({id: id, type: 'image'});
                        // }
                        list.push({id: item.images[0], type: MediaTypeEnum.image});
                    }
                    if (item.videos && (mediaType === MediaTypeEnum.all || mediaType === MediaTypeEnum.video)) {
                        // for (let id of item.videos) {
                        //     list.push({id: id, type: 'video'});
                        // }
                        list.push({id: item.videos[0], type: MediaTypeEnum.video});
                    }
                    if (item.sounds && (mediaType === MediaTypeEnum.all || mediaType === MediaTypeEnum.sound)) {
                        // for (let id of item.sound) {
                        //     list.push({id: id, type: 'sound'});
                        // }
                        list.push({id: item.sounds[0], type: MediaTypeEnum.sound});
                    }
                })

                if (includeUserFq) {
                    if (page == 0) {
                        setItems(list);
                        setOccurrenceCount(data.totalRecords);
                        setFilteredFacetResults(data.facetResults);
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
        return new Intl.NumberFormat('en').format(num); // TODO: move to helper and add locale detection
    }

    // Helper to invert a Record<string, string> object to Record<string, string[]>
    // E.g., `{a: 'one', b: 'one, c: 'two'} -> {one: ['a','b'], two: ['c']}`
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

    // Bunch of methods to handle facet filtering - A bit of a Rube Goldberg machine unfortunately

    // Check if a facet value is active (should be shown as checked)
    const fqValueIsActive = (facetName: string, facetValue: string) : boolean => {
        const fqTriggeredForField = fqUserTrigged[facetName];
        return (fqTriggeredForField) ? fqTriggeredForField?.includes(facetValue) : false;
    };

    // Checkbox group reusable component
    const FilterCheckBoxGroup = ({ fieldName, limit = maxVisibleFacets, grouped = false }: { fieldName: string, limit?: number, grouped?: boolean }) => {
        // Update the fqUserTrigged state when clicked
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

        // Create 2 lists of facet values - one for the unfiltered results and one for the filtered results.
        // Unfiltered is for displaying the list of facets & counts, filtered is for displaying the counts, depending on
        // whether a filter has an active value or not.
        let fieldsToDisplay: FacetResult[] = facetResults.filter(facet => facet.fieldName === fieldName).map(facet => facet.fieldResult)[0];
        let fieldsFilteredCounts: FacetResult[] = filteredFacetResults.filter(facet => facet.fieldName === fieldName).map(facet => facet.fieldResult)[0];
        const fieldIsFiltered = (fieldName in fqUserTrigged && fqUserTrigged[fieldName].length > 0); 

        if (grouped) {
            // If the field is grouped, then we need to create synthetic entries based on the fieldMapping
            const typeMap = fieldMapping[fieldName as keyof typeof fieldMapping] || {}; // e.g. {'Machine observation': 'Occurrences', 'Preserved specimen': 'Specimens', ...}
            const invertedTypeMap = invertObject(typeMap); // e.g. {'Occurrences': ['Machine observation','Observation, ...], 'Specimens': ['Preserved specimen','Material sample', ...]}
            
            const generateSyntheticFields = (
                invertedTypeMap: Record<string, string[]>,
                fields: FacetResult[] | undefined,
                fieldsToDisplay: FacetResult[] | undefined
            ): FacetResult[] => {
                return Object.entries(invertedTypeMap).map(([key, values]: [string, string[]]) => {
                    const availableValues = fields?.filter(field => values.includes(field.label));
            
                    // If no `facetResults` values are available for the synthetic field,
                    // then we need to create an empty entry with count 0 (disabled)
                    if (!availableValues || availableValues.length === 0) {
                        return { label: key, count: 0, fq: '', i18nCode: '' };
                    }
            
                    const totalCount: number = availableValues.reduce((acc, field) => acc + field.count, 0); // Sum of counts
                    const fq: string = fieldsToDisplay
                        ?.filter(field => values.includes(field.label))
                        .map(field => field.fq)
                        .join('+OR+') || '';
                    return { label: key, count: totalCount, fq: fq, i18nCode: '' };
                });
            };
            
            const syntheticFields: FacetResult[] = generateSyntheticFields(invertedTypeMap, fieldsToDisplay, fieldsToDisplay);
            const syntheticFilteredFields: FacetResult[] = generateSyntheticFields(invertedTypeMap, fieldsFilteredCounts, fieldsToDisplay);

            fieldsToDisplay = syntheticFields.sort((a, b) => b.count - a.count);
            fieldsFilteredCounts = syntheticFilteredFields.sort((a, b) => b.count - a.count);
        }

        const getFilteredCount = (fieldName: string): number => {
            return fieldsFilteredCounts.filter(field => field.label === fieldName)[0]?.count || 0;
        }

        return (
            <>
                {fieldsToDisplay?.map((item, idx) =>
                    <Collapse in={idx < limit || expandCollapseState[fieldName as keyof typeof expandCollapseState]} key={idx}>
                        <Checkbox
                            size="xs"
                            // turned off for now, as we can't providing accurate counts for each facet value, once filtering is applied
                            disabled={ fieldIsFiltered ? item.count === 0 : getFilteredCount(item.label) === 0 }
                            checked={fqValueIsActive(fieldName, item.fq)}
                            onChange={() => { updateUserFqs(item.fq, fqValueIsActive(fieldName, item.fq))}}
                            label={<>
                                <Text span c={item.count === 0 ? 'gray' : 'default'}>
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
                                    {formatNumber(fieldIsFiltered ? item.count : getFilteredCount(item.label))}
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

    // Thumbnail image component, with its own useState so we can show a skeleton while image is loading
    const ImageThumbnailModal = ({imageId, type}:{imageId: string, type: MediaTypeValues}) => {
        const [loading, setLoading] = useState(true);

        return (
            <Flex maw={gridWidthTypical} h={gridHeight} justify="center" align="center" direction="column" style={{overflow: 'hidden', borderRadius: 12}}>
                {type === MediaTypeEnum.image &&
                    <UnstyledButton 
                        onClick={() => handleOpenModal(imageId)}
                    >
                        <Image
                            radius="md"
                            h={loading ? 0 : gridHeight}
                            maw={loading ? 0 : gridWidthTypical}
                            src={getImageThumbnailUrl(imageId)}
                            onMouseOver={(event) => {
                                const target = event.target as HTMLImageElement;
                                target.style.transform = 'scale(1.1)';
                                target.style.transition = 'transform 0.3s ease';
                            }}
                            onMouseOut={(event) => {
                                const target = event.target as HTMLImageElement;
                                target.style.transform = 'scale(1.0)';
                                target.style.transition = 'transform 0.3s ease';
                            }}
                            onLoad={(event) => {
                                const target = event.target as HTMLImageElement;
                                
                                if (target && target.complete) {
                                    setLoading(false);
                                } 
                            }}
                            onError={(e) => handleImageError(0, e)}
                        />
                        {loading && <Skeleton height={gridHeight} width={gridWidthTypical} radius="md" styles={{ root: {display: 'inline-block'}}}/>}
                    </UnstyledButton>
                }
                {(type === MediaTypeEnum.sound || type === MediaTypeEnum.video) &&
                    <Button 
                        variant="subtle" color="gray"
                        h="100%"
                        w={200}
                        radius={10}
                        className={classes.mediaIconBtn}
                        style={{ textWrap: 'wrap' }}
                        fz='md'
                        onClick={() => handleOpenModal(imageId)}
                    >
                        { type === MediaTypeEnum.sound && <><IconVolume size={80} stroke={1.5} color="gray" />Sound file</> }
                        { type === MediaTypeEnum.video && <><IconMovie size={80} stroke={1.5} color="gray" />Video file</> }
                    </Button>
                }    
                <Modal
                    opened={opened && openModalId === imageId}
                    onClose={handleCloseModal}
                    size="auto"
                    title={ <Anchor
                            display="block"
                            target="_blank"
                            ml={5}
                            fw="bold"
                            mt="xs"
                            size="md"
                            href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${imageId}`}
                        >View {type} file details <IconExternalLink size={20}/></Anchor>}
                >
                    { type === MediaTypeEnum.image && 
                        <Image
                            radius="md"
                            mah="80vh"
                            h="100%"
                            src={ getImageOriginalUrl(imageId) }
                        />
                    }
                    { type === MediaTypeEnum.sound &&
                        <audio controls preload="auto" style={{ width: '50vw', margin: '50px'}}>
                            <source
                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${imageId}`}
                                type="audio/mpeg"
                                width="100%"
                            />
                        </audio>
                    }
                    { type === MediaTypeEnum.video &&
                        <video controls preload="false" style={{ maxWidth: '100%', maxHeight: '80vh'}}>
                            <source
                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${imageId}`}
                            />
                        </video>
                    }
                </Modal>
            </Flex>
        );
    }

    return (
        <Box>
            <Flex gap="md" direction={{ base: 'column', sm: 'row' }}>
            { Object.keys(mediaFqMap).map((key, idx) => // all, image, video, sound
                <Button
                    key={idx}
                    variant={key === mediaType ? 'filled' : 'outline'}
                    onClick={() => {
                        resetView();
                        setMediaType(key as MediaTypeValues);
                    }}
                >{capitalizeFirstLetter(key)}{key !== 'all' && 's'}</Button>
            )}
            </Flex>
            <Text mt="lg" mb="md" size="md" fw="bold">
                Showing {occurrenceCount > 0 ? (occurrenceCount < (page+1)*pageSize ? occurrenceCount : (page+1)*pageSize) : 0} {' '}
                of {formatNumber(occurrenceCount)} results.{' '}
                <Anchor
                    href={`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/search?q=lsid:${result?.guid}&fq=multimedia:*#tab_recordImages`}
                    target="_blanks"
                    inherit
                >View all occurrence records</Anchor>
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
                                <ImageThumbnailModal imageId={item.id} type={item.type as MediaTypeValues} />
                            </Flex>
                        )}
                        { loading &&
                            [...Array(10)].map((_ , idx) =>
                                <Box key={idx} w={gridWidthTypical} h={gridHeight}>
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
