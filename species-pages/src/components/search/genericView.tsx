/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from "react";
import classes from "./search.module.css";

import capitalise from "../../helpers/Capitalise.ts";
import {GenericViewProps} from "../../api/sources/model.ts";
import {useNavigate} from "react-router-dom";
import CheckIcon from "../common-ui/icons/checkIcon.tsx";
import CheckDisabledIcon from "../common-ui/icons/checkDisabledIcon.tsx";
import CheckedIcon from "../common-ui/icons/checkedIcon.tsx";
import ListIcon from "../common-ui/icons/listIcon.tsx";
import TileIcon from "../common-ui/icons/tileIcon.tsx";
import {Examples} from "./examples.tsx";
import Pagination from "../common-ui/pagination.tsx";

interface GenericProps {
    queryString: string | null,
    setQuery: (query: string) => void,
    props: GenericViewProps,
    tab: string,
    isMobile: boolean
}

function GenericView({
                         queryString,
                         setQuery,
                         props,
                         tab,
                         isMobile
                     }: GenericProps) {
    const [filter, setFilter] = useState<string>(() => localStorage.getItem("searchView") || 'list');
    const [resultData, setResultData] = useState<any[]>([]);
    const [page, setPage] = useState<number>(0);
    const [maxResults, setMaxResults] = useState<number>(0);
    const [sortValue, setSortValue] = useState(() => {
        var value = localStorage.getItem("searchSort") || '';
        if (!props.sortByDate && value === '&sort=created&dir=desc') {
            value = ''; // if sortByDate is not set, default to relevance
        }
        return value;
    }); // default to relevance
    const [loading, setLoading] = useState<boolean>(true);
    const [facetLoading, setFacetLoading] = useState<boolean>(true);
    const [customFacetLoading, setCustomFacetLoading] = useState<boolean>(true);
    const [facets, setFacets] = useState<any[]>([]);
    const [customFacetData, setCustomFacetData] = useState<any[]>([]);
    const [facetFqs, setFacetFqs] = useState<string[]>([]);
    const [sortData, _] = useState<any[]>(() => {
            var list = [
                {label: "Most relevant", value: ""},
                {label: "Newest", value: "&sort=created&dir=desc"},
                {label: "Sort by A-Z", value: "&sort=nameSort&dir=asc"},
                {label: "Sort by Z-A", value: "&sort=nameSort&dir=desc"}
            ]
            if (!props.sortByDate) {
                // remove the "Newest" option if sortByDate is not set
                list = list.filter(item => item.value !== "&sort=created&dir=desc");
            }
            return list;
        }
    );
    const [showRefineDialog, setShowRefineDialog] = useState(false);

    const navigate = useNavigate();
    const pageSize = 12;
    const deepPagingMaxPage = Math.floor(10000 / 12);

    useEffect(() => {
        // queryString has changed, reset facetFqs, page number and get results. Keep the same sort.
        setFacetFqs([]);
        setPage(0);

        // pass the resets into getResults because the above set* calls will not finish first
        getResults({page: 0, facetFqs: []}, true);
    }, [queryString]);

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
        console.log("page", overrides, thisPage, "sort", thisSortValue, "facetFqs", thisFacetFqs, "getFacets", getFacets);

        const url = import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) +
            "&facets=" + Object.keys(props.facetDefinitions).join(",") + (props.customFacets ? "," + props.customFacets.join(",") : "") +
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
                            props.addCustomFacetsFn({
                                url,
                                getFacets,
                                thisFacetFqs,
                                parentData: data,
                                setCustomFacetData: (newData: any[]) => applyCustomFacetData(newData, thisFacetFqs, getFacets)
                            });
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

    function saveFilter(newFilter: string) {
        localStorage.setItem("searchView", newFilter);
        setFilter(newFilter);
    }

    function saveSort(newSort: string) {
        localStorage.setItem("searchSort", newSort);
        setSortValue(newSort);
        setPage(0);
        getResults({sortParam: newSort, page: 0}, false);
    }

    function applyCustomFacetData(data: any [], thisFacetFqs: string[], getFacets: boolean) {
        // when not getting facets, only update existing facets with new counts
        if (!getFacets) {
            // loop through customFacetData facets
            customFacetData.forEach((existingFacet: any) => {
                // find the new data with the same name
                var newFacet = data.find((f: any) => f.name == existingFacet.name);
                if (newFacet) {
                    // update existing items with new counts
                    existingFacet.items.forEach((existingItem: any) => {
                        var newItem = newFacet.items.find((i: any) => i.fq == existingItem.fq);
                        if (newItem) {
                            existingItem.count = newItem.count;
                        } else {
                            existingItem.count = 0; // reset count if not found
                        }
                        existingItem.selected = thisFacetFqs.includes(existingItem.fq);
                    });
                } else {
                    // reset counts to 0
                    existingFacet.items.forEach((existingItem: any) => {
                        existingItem.count = 0;
                        existingItem.selected = thisFacetFqs.includes(existingItem.fq);
                    });
                }
            });
            setCustomFacetData(customFacetData.slice());
            setCustomFacetLoading(false);
        } else {
            setCustomFacetData(data);
            setCustomFacetLoading(false);
        }
    }

    function toggleItem(item: any) {
        setLoading(true);

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
    }

    function updatePage(number: number) {
        setPage(number);
        getResults({page: number}, false);
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    const refineResults = <>
        {(loading || maxResults > 0) && queryString && facets.length + customFacetData.length > 0 &&
            <div style={{marginRight: "30px"}}>
                <span className={classes.refineTitle}>Refine results</span>
                {(facetLoading || customFacetLoading) &&
                    <div className="placeholder-glow mt-3" style={{height: "100px"}}></div>}
                {!facetLoading && !customFacetLoading && [...facets, ...customFacetData].sort((a, b) => a.order - b.order).map((facet: any, index: number) =>
                    <div key={index}>
                                <span className={classes.refineSectionTitle}
                                      style={{marginTop: "15px", marginBottom: "10px"}}>{facet.name}</span>
                        {facet.items && facet.items.map((item: any, index: number) =>
                            <React.Fragment key={index}>
                                {index > 0 && <div style={{height: "6px"}}/>}
                                <div className="d-flex align-items-start gap-2"
                                     style={{
                                         cursor: (!item.selected && item.count == 0 ? "auto" : "pointer"),
                                         marginLeft: `${22 * item.depth}px`
                                     }}
                                     onClick={() => {
                                         item.count > 0 && toggleItem(item)
                                     }}
                                >
                                    {!item.selected && item.count > 0 && <CheckIcon size="16"/>}
                                    {!item.selected && item.count == 0 && <CheckDisabledIcon size="16"/>}
                                    {item.selected && <CheckedIcon size="16"/>}
                                    <span className={classes.refineItem}>{item.label} ({item.count})</span>
                                </div>
                            </React.Fragment>
                        )}
                    </div>
                )}
            </div>
        }</>

    return <>
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

        {!loading && !queryString && <Examples tab={tab} setQueryAndTab={(query: string) => {
            setQuery(query)
        }}/>}

        <div className="row">
            {isMobile ?
                (queryString && <div style={{marginBottom: "30px"}}>
                    <button onClick={() => setShowRefineDialog(true)} className={"ala-btn-secondary"} style={{width: "100%"}}>
                        Refine results</button>
                </div>)
                :
                <div className="col-3">
                    {refineResults}
                </div>
            }
            <div className={isMobile ? "col-12" : "col-9"}>
                {loading && <div className="placeholder-glow" style={{height: "28px"}}></div>}
                {!loading && queryString && <div className="d-flex align-items-center flex-wrap gap-2">
                    <span className={classes.resultsTitle}>Showing</span>
                    {maxResults > 0 && <span
                        className={classes.resultsTitleBold}>{(page) * pageSize + 1}-{maxResults < (page + 1) * pageSize ? maxResults : (page + 1) * pageSize}</span>}
                    {maxResults > 0 && <span className={classes.resultsTitle}>of</span>}
                    <span className={classes.resultsTitleBold}>{maxResults}</span>
                    <span className={classes.resultsTitle}>results for</span>
                    <span className={classes.resultsTitleItalic}>{queryString}</span>
                </div>
                }
                {maxResults > 0 && <>
                    <div className="d-flex justify-content-between" style={{marginTop: isMobile ? "20px" : "30px"}}>
                        <div className="d-flex align-items-center gap-3">
                            <span className={classes.headerLabels}>View as</span>
                            <button onClick={() => {
                                saveFilter("list")
                            }}
                                    className={`${filter == "list" ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}
                            >
                                <ListIcon size={"14"}/>List
                            </button>
                            <button onClick={() => saveFilter("tiles")}
                                    className={`${filter == "tiles" ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}
                            >
                                <TileIcon size={"14"}/>Tiles
                            </button>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            {!isMobile && <span className={classes.headerLabels}>Sort by</span>}
                            <select
                                className={`form-select ${classes.alaSelect}`}
                                value={sortValue}
                                onChange={e => {
                                    saveSort(e.target.value);
                                    getResults({sortParam: e.target.value}, false);
                                }}
                            >
                                {sortData.map((option: any, idx: number) => (
                                    <option key={idx} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={{marginTop: isMobile ? "20px" : "30px"}}></div>
                </>}
                {loading && <div
                    className="placeholder-glow"
                    style={{height: filter === "list" ? "1185px" : "1595px"}}
                >Loading...</div>}
                {!loading && <>
                    {filter == "list" && resultData.map((item: any, index: number) =>
                        <React.Fragment key={index}>
                            {props.renderListItemFn({item, navigate, wide: false, isMobile})}
                            <hr style={{marginTop: "15px"}}/>
                        </React.Fragment>
                    )}
                    {filter == "tiles" &&
                        <div className="row" style={{marginLeft: "-20px", marginRight: "-20px", marginTop: isMobile ? "-15px" : "-20px"}}>
                            {resultData.map((item: any, index: number) =>
                                <div className={isMobile ? "col-12" : "col-4"} key={index} style={{
                                    paddingLeft: "20px",
                                    paddingRight: "20px",
                                    paddingTop: isMobile ? "15px" : "20px",
                                    paddingBottom: isMobile ? "0px" : "20px"
                                }}>
                                    {props.renderTileItemFn({item, navigate, wide: false, isMobile})}
                                </div>
                            )}
                        </div>
                    }
                </>
                }
                {!facetLoading && !customFacetLoading && maxResults > 0 &&
                    <Pagination page={page} maxResults={maxResults} pageSize={pageSize} deepPagingMaxPage={deepPagingMaxPage}
                                onPageChange={updatePage} isMobile={isMobile}/>
                }
            </div>

            {props.resourceLinks && props.resourceLinks.length > 0 &&
                <div className="d-flex flex-row justify-content-center align-items-center"
                     style={{marginTop: "60px", gap: "20px"}}>
                    {props.resourceLinks.map((link, index) => (
                        <a key={index} href={link.url} target="_blank"
                           className={"btn ala-btn-primary"}>
                            {link.label}
                        </a>
                    ))}
                </div>
            }
        </div>

        {showRefineDialog && (
            <div style={{
                position: "fixed",
                top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.8)",
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
                 onClick={() => setShowRefineDialog(false)}
            >
                <div style={{
                    background: "#fff",
                    borderRadius: "5px",
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: "15px",
                    position: "relative"
                }}
                     onClick={e => e.stopPropagation()}
                >
                    <button
                        style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "none",
                            border: "none",
                            fontSize: "1.5rem"
                        }}
                        onClick={() => setShowRefineDialog(false)}
                        aria-label="Close"
                    >&times;</button>
                    {refineResults}
                </div>
            </div>
        )}
    </>
}

export default GenericView;
