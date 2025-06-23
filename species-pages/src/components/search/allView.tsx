/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Fragment, useEffect, useState} from "react";
import classes from "./search.module.css";
import {useNavigate} from "react-router-dom";
import {speciesDefn} from "./props/speciesDefn.tsx";
import {datasetsDefn} from "./props/datasetsDefn.tsx";
import {dataprojectsDefn} from "./props/dataprojectsDefn.tsx";
import {specieslistDefn} from "./props/specieslistDefn.tsx";
import {environmentallayersDefn} from "./props/environmentallayersDefn.tsx";
import {regionslocalitiesDefn} from "./props/regionslocalitiesDefn.tsx";
import {wordpressDefn} from "./props/wordpressDefn.tsx";
import {supportDefn} from "./props/supportDefn.tsx";
import ListIcon from "../common-ui/icons/listIcon.tsx";
import TileIcon from "../common-ui/icons/tileIcon.tsx";
import ArrowRightIcon from "../common-ui/icons/arrowRightIcon.tsx";
import {Examples} from "./examples.tsx";
import {GenericViewProps} from "../../api/sources/model.ts";

interface ViewProps {
    queryString?: string | null
    setQuery: (query: string) => void
    setTab: (tab: string) => void
    isMobile: boolean
}

function AllView({queryString, setQuery, setTab, isMobile}: ViewProps) {
    const [filter, setFilter] = useState(() => localStorage.getItem("searchView") || 'list');
    const [groups, setGroups] = useState<any[]>([]);
    const [total, setTotal] = useState<number>(0);

    const navigate = useNavigate();

    type MappingType = {
        [key: string]: string | undefined;
    };

    const groupMapping: MappingType = {
        "TAXON": "Species",
        "LAYER": "Spatial layers",
        "REGION": "Locations",
        "LOCALITY": "Locations",
        "DATARESOURCE": "Datasets",
        "DATAPROVIDER": "Datasets",
        "INSTITUTION": "Datasets",
        "COLLECTION": "Datasets",
        "SPECIESLIST": "Species list",
        "WORDPRESS": "General content",
        "KNOWLEDGEBASE": "Help articles",
        "COMMON": "Species",
        "BIOCOLLECT": "Data projects",
        "DIGIVOL": "Data projects",
        "DISTRIBUTION": undefined
    };

    const groupFq: MappingType = {
        "Species": "idxtype:TAXON OR idxtype:COMMON",
        "Datasets": "idxtype:DATARESOURCE OR idxtype:DATAPROVIDER OR idxtype:INSTITUTION OR idxtype:COLLECTION",
        "Species list": "idxtype:SPECIESLIST",
        "Data projects": "idxtype:BIOCOLLECT OR idxtype:DIGIVOL",
        "Spatial layers": "idxtype:LAYER",
        "Locations": "idxtype:REGION OR idxtype:LOCALITY",
        "General content": "idxtype:WORDPRESS",
        "Help articles": "idxtype:KNOWLEDGEBASE"
    };

    useEffect(() => {
        // reset groups
        setGroups([])

        // reset total
        setTotal(-1)

        if (!queryString) {
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) + "&facets=idxtype&pageSize=0")
            .then(response => response.json())
            .then(data => {
                var searchGroups: { [key: string]: { count: number, label: string, items: any[], tabName: string, defn: GenericViewProps } } = {
                    "Species": {count: 0, label: "Species", items: [], tabName: "species", defn: speciesDefn},
                    "Datasets": {count: 0, label: "Datasets", items: [], tabName: "datasets", defn: datasetsDefn},
                    "Species list": {count: 0, label: "Species list", items: [], tabName: "specieslists", defn: specieslistDefn},
                    "Data projects": {count: 0, label: "Data projects", items: [], tabName: "dataprojects", defn: dataprojectsDefn},
                    "Spatial layers": {
                        count: 0,
                        label: "Spatial layers",
                        items: [],
                        tabName: "environmentallayers",
                        defn: environmentallayersDefn
                    },
                    "Locations": {
                        count: 0,
                        label: "Locations",
                        items: [],
                        tabName: "regionslocalities",
                        defn: regionslocalitiesDefn
                    },
                    "General content": {
                        count: 0,
                        label: "General content",
                        items: [],
                        tabName: "alageneralcontent",
                        defn: wordpressDefn
                    },
                    "Help articles": {count: 0, label: "Help articles", items: [], tabName: "helparticles", defn: supportDefn}
                }
                if (data?.facetResults && data.facetResults[0] && data.facetResults[0].fieldResult) {
                    data.facetResults[0].fieldResult.forEach((facet: any) => {
                        var group: string | undefined = groupMapping[facet.label];
                        if (group) {
                            searchGroups[group].count = searchGroups[group].count + facet.count;
                        }
                    })
                }

                setTotal(data.totalRecords)

                // fetch the first 4 results for each
                Object.values(searchGroups).forEach((group: any) => {
                    if (group.count > 0) {
                        fetch(import.meta.env.VITE_APP_BIE_URL +
                            "/v2/search?q=" + encodeURIComponent(queryString as string) +
                            "&pageSize=4&fq=" + encodeURIComponent(groupFq[group.label] || ""))
                            .then(response => response.json())
                            .then(data => {
                                if (data?.searchResults) {
                                    var list: any [] = []
                                    data.searchResults.forEach((result: any) => {
                                        list.push(result)
                                    })

                                    setGroups(prevGroups =>
                                        prevGroups.map(g =>
                                            g.label === group.label
                                                ? { ...g, items: list }
                                                : g
                                        )
                                    );
                                }
                            })
                    }
                })
                setGroups(Object.values(searchGroups))
            });
    }, [queryString]);

    function saveFilter(filter: string) {
        localStorage.setItem("searchView", filter);
        setFilter(filter);
    }

    return (<>
            {total > 0 &&
                <>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                        <span className={classes.resultsTitle}>Showing results for</span>
                        <span className={classes.resultsTitleItalic}>{queryString}</span>
                    </div>

                    <div className="d-flex align-items-center gap-3 flex-wrap"
                         style={{marginTop: isMobile ? "20px" : "30px"}}>
                        <span style={{lineHeight: "36px"}} className={classes.headerLabels}>View as</span>
                        <button onClick={() => {saveFilter("list")}}
                                className={`${filter == "list" ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}>
                            <ListIcon/>List
                        </button>
                        <button onClick={() => saveFilter("tiles")}
                                className={`${filter == "tiles" ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}>
                            <TileIcon/>Tiles
                        </button>
                    </div>
                    </>
            }
            {
                queryString && total == 0 ? <span style={{marginTop: "60px", display: "block"}}>No results found</span>
                :
                total == -1 && !queryString ? <Examples tab="" setQueryAndTab={(query: string, tab: string | undefined) => {setQuery(query); setTab(tab || "");}}/>
                : null
            }
            {groups.map((group, index) =>
                <Fragment key={index}>
                    {group.count > 0 && <>
                        <div className="d-flex justify-content-between"
                             onClick={() => setTab(group.tabName)}
                             style={{marginBottom: "30px", marginTop: isMobile ? "30px" : "60px"}}>
                            <span className={classes.groupName}>{group.label}</span>
                            <a className={classes.groupCount}
                            >See {group.count} results <ArrowRightIcon/></a>
                        </div>
                        {filter == "list" && <>
                            {group.items && group.items.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {group.defn.renderListItemFn({item, navigate, wide: true, isMobile})}
                                    <hr style={{ marginTop: "15px"}}/>
                                </Fragment>
                            )}
                        </>}
                        {filter == "tiles" &&
                            <div className="row">
                                {group.items && group.items.map((item: any, index: number) =>
                                    <div className={isMobile ? "col-12" : "col-3"} key={index}
                                         style={{paddingLeft: "20px", paddingRight: "20px", marginBottom: isMobile ? "15px" : ""}}>
                                        {group.defn.renderTileItemFn({item, navigate, wide: true, isMobile})}
                                    </div>
                                )}
                            </div>
                        }
                    </>
                    }
                </Fragment>
            )}
        </>
    )
}

export default AllView;
