import {useEffect, useState} from "react";
import {
    Box,
    Button,
    Divider,
    Flex,
    Grid,
    Select,
    Skeleton,
    Space,
    Text
} from "@mantine/core";
import classes from "./search.module.css";
import {
    ChevronDownIcon,
    ListIcon,
    TilesIcon
} from '@atlasoflivingaustralia/ala-mantine';

import capitalise from "../../helpers/Capitalise.ts";
import {GenericViewProps} from "../../api/sources/model.ts";
import {useNavigate} from "react-router-dom";
import CheckIcon from "../common/checkIcon.tsx";
import CheckDisabledIcon from "../common/checkDisabledIcon.tsx";
import CheckedIcon from "../common/checkedIcon.tsx";

interface GenericProps {
    queryString: string,
    props: GenericViewProps
}

function GenericView({
                         queryString,
                         props
                     }: GenericProps) {
    const [filter, setFilter] = useState<string>("list");
    const [resultData, setResultData] = useState<any[]>([]);
    const [page, setPage] = useState<number>(0);
    const [maxResults, setMaxResults] = useState<number>(0);
    const [sortValue, setSortValue] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [facetLoading, setFacetLoading] = useState<boolean>(true);
    const [customFacetLoading, setCustomFacetLoading] = useState<boolean>(true);
    const [facets, setFacets] = useState<any[]>([]);
    const [customFacetData, setCustomFacetData] = useState<any[]>([]);
    const [facetFqs, setFacetFqs] = useState<string[]>([]);
    const [sortData, setSortData] = useState<any[]>([
        {label: "Most relevant", value: ""},
        {label: "Sort by A-Z", value: "&sort=name&dir=asc"},
        {label: "Sort by Z-A", value: "&sort=name&dir=desc"},
    ]);

    const navigate = useNavigate();
    const pageSize = 12;
    const deepPagingMaxPage = Math.floor(10000 / 12);

    useEffect(() => {
        if (props.sortByDate) {
            setSortData([
                {label: "Most relevant", value: ""},
                {label: "Newest", value: "&sort=created&dir=desc"},
                {label: "Sort by A-Z", value: "&sort=nameSort&dir=asc"},
                {label: "Sort by Z-A", value: "&sort=nameSort&dir=desc"}
            ]);
        }
    })

    useEffect(() => {
        // queryString has changed, reset facetFqs, page number and get results. Keep the same sort.
        setFacetFqs([]);
        setPage(0);

        // pass the resets into getResults because the above set* calls will not finish first
        getResults({page: 0, facetFqs: []}, true);
    }, [queryString]);

    // TODO: lock the UI while loading because it is causing issues when still enabled
    function getResults(overrides: {
        sortParam?: string,
        page?: number,
        facetFqs?: string []
    } = {}, getFacets: boolean) {
        if (!queryString) {
            // reset everything
            setResultData([]);
            setMaxResults(0);
            setFacets([]);
            setCustomFacetData([]);
            setLoading(false);
            setFacetLoading(false);
            setCustomFacetLoading(false);
            return;
        }

        setLoading(true);

        if (getFacets) {
            setFacetLoading(true);
            setCustomFacetLoading(true);
        }

        const thisSortValue = overrides?.sortParam !== undefined ? overrides.sortParam : sortValue;
        const thisPage = overrides?.page !== undefined ? overrides.page : page;
        const thisFacetFqs = overrides?.facetFqs !== undefined ? overrides.facetFqs : facetFqs;

        const url = import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) +
            "&facets=" + Object.keys(props.facetDefinitions).join(",") +
            (thisFacetFqs.length > 0 ? "&fq=" + thisFacetFqs.map(fq => encodeURIComponent(fq)).join("&fq=") : "") + // the 'drill down' does not update the facets section
            "&pageSize=" + pageSize + "&fq=" + encodeURIComponent(props.fq) + "&page=" + thisPage + thisSortValue;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                setMaxResults(data.totalRecords)

                if (data.searchResults) {
                    const list: any[] = []
                    data.searchResults.forEach((result: any) => {
                        list.push(result)
                    })
                    setResultData(list)

                    // begin facet processing only when this is an initial query
                    var facetList: any  [] = []
                    if (data?.facetResults && data.facetResults[0] && data.facetResults[0].fieldResult) {
                        // retain the order of the facets as defined in the facetDefinitions
                        Object.keys(props.facetDefinitions).forEach((facetName: string) => {
                            var facet = data.facetResults.find((f: any) => f.fieldName == facetName)
                            if (facet) {
                                const parseFacetFn = props.facetDefinitions[facetName].parseFacetFn;

                                if (parseFacetFn) {
                                    // custom facet parsing
                                    parseFacetFn(facet, facetList);
                                } else {
                                    // basic facets
                                    var items: any[] = []
                                    facet.fieldResult.forEach((status: any) => {
                                        var fq = facet.fieldName + ":\"" + status.label + "\"";
                                        items.push({
                                            fq: fq,
                                            label: capitalise(status.label),
                                            count: status.count,
                                            depth: 0
                                        })
                                    })
                                    if (items.length > 0) {
                                        // sort by label
                                        items.sort((a: any, b: any) => {
                                            return a.label.localeCompare(b.label)
                                        })

                                        facetList.push({
                                            name: props.facetDefinitions[facet.fieldName].label,
                                            items: items,
                                            order: props.facetDefinitions[facet.fieldName].order
                                        })
                                    }
                                }
                            }
                        });

                        if (!getFacets) {
                            // Update the existing "facets" counts with those found in "facetList".
                            // This keeps the counts up to date while retaining the "undo"/"back" functionality of the Refine UI.
                            let facetCopy = facets.slice();
                            facetCopy.forEach((existingFacet: any) => {
                                var newFacet = facetList.find((f: any) => f.name == existingFacet.name)
                                if (newFacet) {
                                    existingFacet.items.forEach((existingItem: any) => {
                                        var newItem = newFacet.items.find((i: any) => i.fq == existingItem.fq)
                                        if (newItem) {
                                            existingItem.count = newItem.count
                                        } else {
                                            existingItem.count = 0;
                                        }
                                        existingItem.selected = thisFacetFqs.includes(existingItem.fq);
                                    })
                                } else {
                                    // reset counts to 0
                                    existingFacet.items.forEach((existingItem: any) => {
                                        existingItem.count = 0;
                                        existingItem.selected = thisFacetFqs.includes(existingItem.fq);
                                    })
                                }
                            })
                            setFacets(facetCopy)
                        } else {
                            setFacets(facetList)
                        }

                        if (props.addCustomFacetsFn) {
                            props.addCustomFacetsFn({url, getFacets, thisFacetFqs, parentData: data, setCustomFacetData: applyCustomFacetData});
                        } else {
                            setCustomFacetLoading(false);
                        }
                    }
                } else {
                    // reset
                    setResultData([])
                }
            }).catch((error) => {
            console.error(error)
        }).finally(() => {
            setLoading(false);
            setFacetLoading(false);
        });
    }

    function applyCustomFacetData(data: any []) {
        setCustomFacetData(data);
        setCustomFacetLoading(false);
    }

    function toggleItem(item: any) {
        setLoading(true);

        // TODO: gettign the error "A component is changing an uncontrolled input to be controlled", i assume from this
        // TODO: sometimes it will not remove the fq, is it because the UI needs locking first?

        let newFacetFqs = facetFqs.slice();
        if (!newFacetFqs.includes(item.fq)) {
            // add fq
            newFacetFqs = [...facetFqs, item.fq]
        } else {
            // remove fq
            newFacetFqs = facetFqs.filter(fq => fq !== item.fq);
        }
        setFacetFqs(newFacetFqs);
        setPage(0)

        getResults({facetFqs: newFacetFqs, page: 0}, false);
        // setTimeout(() => {
        //     getResults({},false);
        // }, 1);
    }

    function updatePage(number: number) {
        setPage(number);
        getResults({page: number}, false);
    }

    return <>
        { /* prevent input when loading */}
        {loading && <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0)',
            zIndex: 9999,
            cursor: 'progress'
        }} onClick={(e) => e.preventDefault()}></div>}

        <Grid>
            <Grid.Col span={3}>
                <Text className={classes.refineTitle}>Refine results</Text>
                {(facetLoading || customFacetLoading) && <Skeleton mt={15} height="100px"/>}
                {!facetLoading && !customFacetLoading && [...facets, ...customFacetData].sort((a, b) => a.order - b.order).map((facet: any, index: number) =>
                    <Box key={index}>
                        <Space h="15px"/>
                        <Text className={classes.refineSectionTitle}>{facet.name}</Text>
                        <Space h="10px"/>
                        {facet.items && facet.items.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="6px"/>}
                                <Flex gap="6px" style={{cursor: (!item.selected && item.count == 0 ? "auto" : "pointer")}}
                                      ml={22 * item.depth}
                                >
                                    {!item.selected && item.count > 0 && <CheckIcon size="16" onClick={() => { toggleItem(item)}}/>}
                                    {!item.selected && item.count == 0 && <CheckDisabledIcon size="16"/>}
                                    {item.selected && <CheckedIcon size="16" onClick={() => { toggleItem(item)}}/>}
                                    <Text fz={14}>{item.label} ({item.count})</Text>
                                </Flex>
                            </>
                        )}
                    </Box>
                )}
            </Grid.Col>
            <Grid.Col span={9}>
                {loading && <Skeleton height="28px"/>}
                {!loading && <Flex>
                    <Text className={classes.resultsTitle}>Showing&nbsp;</Text>
                    {maxResults > 0 && <Text
                        className={classes.resultsTitleBold}>{(page) * pageSize + 1}-{maxResults < (page + 1) * pageSize ? maxResults : (page + 1) * pageSize}</Text>}
                    {maxResults > 0 && <Text className={classes.resultsTitle}>&nbsp;of&nbsp;</Text>}
                    <Text className={classes.resultsTitleBold}>{maxResults}</Text>
                    <Text className={classes.resultsTitle}>&nbsp;results for&nbsp;</Text>
                    <Text className={classes.resultsTitleItalic}>{queryString}</Text>
                </Flex>
                }
                <Space h="30px"/>
                <Flex style={{justifyContent: 'space-between'}}>
                    <Flex gap="15px">
                        <Text style={{lineHeight: "36px"}}>View
                            as</Text> {/* this line height matches that of the ala-filter button */}
                        <Button variant="ala-filter" onClick={() => {
                            setFilter("list")
                        }}
                                className={(filter == "list") ? classes.activeFilter : classes.disabledFilter}
                        >
                            <ListIcon color="#637073"/>List</Button>
                        <Button onClick={() => setFilter("tiles")} variant="ala-filter"
                                className={(filter == "tiles") ? classes.activeFilter : classes.disabledFilter}
                        >
                            <TilesIcon color="#637073"/>Tiles</Button>
                    </Flex>
                    <Flex gap="15px">
                        <Text style={{lineHeight: "36px"}}>Sort by</Text>
                        <Select className={classes.alaSelect} data={sortData} value={sortValue}
                                onChange={(value: any) => {
                                    setSortValue(value);
                                    getResults({sortParam: value}, false);
                                }}
                                rightSection={<ChevronDownIcon/>}
                                comboboxProps={{offset: 0}}
                                withCheckIcon={false}
                                allowDeselect={false}
                        />
                    </Flex>
                </Flex>
                <Space h="30px"/>
                <Text className={classes.topResult}>Top Result</Text>
                <Space h="15px"/>
                {loading && <Skeleton height={filter == "list" ? "1185px" : "1595px"}/>}
                {!loading && resultData.length == 0 &&
                    <Text>No results found</Text>
                }
                {!loading && <>
                    {filter == "list" && resultData.map((item: any, index: number) =>
                        <>
                            {index > 0 && <Space h="10px"/>}
                            {props.renderListItemFn({item, navigate, wide: false})}
                            <Divider mt="15px"/>
                        </>
                    )}
                    {filter == "tiles" &&
                        <Grid gutter={40}>
                            {resultData.map((item: any, index: number) =>
                                <Grid.Col span={4} key={index}>
                                    {props.renderTileItemFn({item, navigate, wide: false})}
                                </Grid.Col>
                            )}
                        </Grid>
                    }
                </>
                }

                {/* TODO: do something about the variable height of the LIST content above. Paging with LIST view is jumping up and down a bit */}
                {!facetLoading && !customFacetLoading && <>
                    <Space h="60px"/>

                    {/* TODO: move this into a component */}
                    <Flex justify="center" gap={10}>
                        {page > 2 && <>
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(0)}
                            >1
                            </button>
                            {page > 3 && <div>...</div>}
                        </>
                        }

                        {page - 1 > 0 && <button className={classes.paginationButton}
                                                 onClick={() => updatePage(page - 2)}>{page - 1}</button>}
                        {page > 0 && <button className={classes.paginationButton}
                                             onClick={() => updatePage(page - 1)}>{page}</button>}
                        <button className={classes.paginationButtonSelected} disabled={true}>{page + 1}</button>
                        {page + 1 < Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) &&
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(page + 1)}>{page + 2}</button>}
                        {page + 2 < Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) &&
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(page + 2)}>{page + 3}</button>}

                        {Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) > page + 3 && page < deepPagingMaxPage && <>
                            {Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) > page + 4 && <div>...</div>}
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) - 1)}
                            >{Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize))}
                            </button>
                            <button className={`${classes.paginationButton} ${classes.next}`}
                                    onClick={() => updatePage(page + 1)}
                            >Next
                            </button>
                        </>
                        }
                    </Flex></>
                }
            </Grid.Col>
        </Grid>
    </>
}

export default GenericView;
