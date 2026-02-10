/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, useUser} from "@ala/common-ui";
import {useEffect, useState} from "react";
import {DataQualityInfo, QualityProfile} from "../api/model.tsx";
import MapView from "../components/mapView.tsx";
import RecordsView from "../components/recordsView.tsx";
import ResultsReturned from "../components/resultsReturned.tsx";
import RecordImages from "../components/recordImages.tsx";
import FacetWell from "../components/facetWell.tsx";
import { Link, useNavigate } from 'react-router-dom';
import {Tab, Tabs} from "react-bootstrap";
import Charts from "../components/charts.tsx";
import ApiModal from "../components/apiModal.tsx";
import CustomizeFilterModal from "../components/customizeFilterModal.tsx";
import DataQuality from "../components/dataQuality.tsx";
import {
    parseAsInteger,
    parseAsStringLiteral,
    useQueryState
} from 'nuqs';
import groupedFacets from "../config/searchGroupedFacets.json";
import defaultFacets from "../config/defaultFacets.json";

const sortOrder = ['asc', 'desc'] as const

function OccurrenceList({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}) {
    const {userInfo} = useUser();

    const [tab, setTab] = useState('records');

    // quick search
    const [quickSearch, setQuickSearch] = useState('');

    const [lastSearch, setLastSearch] = useState('');

    // searching
    // const [query, setQuery] = useQueryState('q');
    // const [fq, setFq] = useQueryState('fq', parseAsNativeArrayOf(parseAsString).withDefault([]));

    //const [lastSearch, setLastSearch] = useState('');
    const [result, setResult] = useState({});
    const [pageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(20));
    const [sort, setSort] = useQueryState('sort', { defaultValue: 'first_loaded_date'});
    const [dir, setDir] = useQueryState('order', parseAsStringLiteral(sortOrder).withDefault('desc'));
    const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
    // const [qualityProfile, setQualityProfile] = useQueryState('qualityProfile');
    // const [disableAllQualityFilters, setDisableAllQualityFilters] = useQueryState('disableAllQualityFilters', parseAsBoolean);
    // const [disableQualityFilter, setDisableQualityFilter] = useQueryState('disableQualityFilter',parseAsNativeArrayOf(parseAsString).withDefault([]));

    const [chartsData, setChartsData] = useState<any>([]);

    // facets
    const [facetList, setFacetList] = useState<string[]>(
        () => {
            const stored = localStorage.getItem('customFacets');
            return stored ? JSON.parse(stored) : defaultFacets;
        }
    );

    // data quality
    const [dataQuality, setDataQuality] = useState<any[]>([])
    const [dataQualityInfo, setDataQualityInfo] = useState<DataQualityInfo>({
        profile: 'disable',
        unfilteredCount: undefined,
        selectedFilters: undefined,
        expand: true
    })

    // modals
    const [apiModalShow, setApiModalShow] = useState(false);
    const [customizeFilterModalShow, setCustomizeFilterModalShow] = useState(false);

    const navigate = useNavigate();

    // get query parameters from URL
    const [queryString, setQueryString] = useState<string>(() => {
        const hash = window.location.href;
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            // remove leading part before "?" and any "#..." at the end
            let qs = hash.substring(queryIndex).split('#')[0];

            // remove the pageSize, sort, dir, start parameters from the query string
            const urlParams = new URLSearchParams(qs);
            urlParams.delete('pageSize');
            urlParams.delete('sort');
            urlParams.delete('dir');
            urlParams.delete('order');
            urlParams.delete('start');
            return '?' + urlParams.toString();
        }
        return '';
    });

    useEffect(() => {
        const onPopState = () => {
            const hash = window.location.href;
            const queryIndex = hash.indexOf('?');
            if (queryIndex !== -1) {
                setQueryString(hash.substring(queryIndex));
            } else {
                setQueryString('');
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        fetchDataQuality();

        // TODO: i18n or config for breadcrumb titles
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Occurrence List', href: '/occurrence-list'},
        ]);
    }, []);

    useEffect(() => {
        fetchIndex();
        fetchDataQuality().then(dqList => loadDqProfile(dqList));
    }, [pageSize, sort, dir, page, queryString]);

    function loadDqProfile(dqList: QualityProfile []) {
        // TODO: Today, dataQualityInfo must align with queryString. This is a problem because both dataQualityInfo and
        //  queryString are used by the dataQuality components and update functions.
        // 1. Change all usage of queryString to dataQualityInfo for dataQuality components.
        // 2. Update all other usage of queryString to append non-parameterized dataQualityInfo settings.
        // 3. All functions that update the queryString based on changes to dataQualityInfo must be updated.
        if (!userInfo?.authenticated) {
            // TODO: load from local storage

            updateAndSaveDataQualityInfoWithQueryString(dqList);
        } else {
            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property", {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + userInfo?.accessToken,
                }
            }).then(response => response.json()).then(data => {
                dataQualityInfo.profile = data.disableAll ? 'disable' : data.profile;
                dataQualityInfo.selectedFilters = [];
                for (let dq of dqList) {
                    if (dq.shortName === dataQualityInfo.profile) {
                        for (let cat of dq.categories) {
                            if (!data.disabledItems.includes(cat.label)) {
                                dataQualityInfo.selectedFilters.push(cat.name);
                            }
                        }
                    }
                }
                dataQualityInfo.expand = data.expand;

                updateAndSaveDataQualityInfoWithQueryString(dqList);
            })
        }
    }

    function initDqFilters(dqList : QualityProfile[], profile : string) : string[] {
        let filters = [];
        for (let dq of dqList) {
            if (dq.shortName === profile) {
                for (let c of dq.categories) {
                    filters.push(c.label);
                }
            }
        }

        return filters;
    }

    function updateAndSaveDataQualityInfoWithQueryString(dqList : QualityProfile[]) {
        // Override defaults with queryString params; .profile, .selectedFilters
        if (queryString?.includes("qualityProfile=") || queryString?.includes("disableAllQualityFilters=")) {
            let terms = (queryString.startsWith('?') ? queryString.substring(1) : queryString).split("&");

            for (let term of terms) {
                if (term.startsWith("qualityProfile=")) {
                    dataQualityInfo.profile = term.substring(15);
                } else if (term.startsWith("disableAllQualityFilters=")) {
                    dataQualityInfo.profile = 'disable';
                }
            }

            // replace all selectedFilters with queryString information
            let filters = initDqFilters(dqList, dataQualityInfo.profile);

            for (let term of terms) {
                if (term.startsWith("disableQualityFilter=")) {
                    let cat = term.substring(21);

                    // remove disabled filter
                    filters = filters.filter(f => f !== cat);
                }
            }

            dataQualityInfo.selectedFilters = filters;
        } else {
            dataQualityInfo.selectedFilters = initDqFilters(dqList, dataQualityInfo.profile);
        }

        setDataQualityInfo(dataQualityInfo)
    }

    function updateDataQualityInfo(dataQualityInfo: DataQualityInfo) {
        // Remove existing dq terms from queryString
        let removeParams : string[] = [];
        if (queryString?.includes("qualityProfile=") || queryString?.includes("disableAllQualityFilters=")) {
            let terms = (queryString.startsWith('?') ? queryString.substring(1) : queryString).split("&");

            for (let term of terms) {
                if (term.startsWith("qualityProfile=")) {
                    removeParams.push(term)
                } else if (term.startsWith("disableAllQualityFilters=")) {
                    removeParams.push(term)
                } else if (term.startsWith("disableQualityFilter=")) {
                    removeParams.push(term)
                }
            }
        }

        // Add new dq terms to queryString
        let newParams : string[] = [];
        if (dataQualityInfo.profile !== 'disable') {
            newParams.push("qualityProfile=" + dataQualityInfo.profile)
        } else {
            newParams.push("disableAllQualityFilters=true")
        }

        // add all dataQuality category labels to newParams
        for (let dq of dataQuality) {
            if (dq.shortName === dataQualityInfo.profile) {
                for (let cat of dq.categories) {
                    if (dataQualityInfo.selectedFilters !== undefined && !dataQualityInfo.selectedFilters?.includes(cat.label)) {
                        newParams.push("disableQualityFilter=" + cat.label)
                    }
                }
            }
        }

        // remove items that appear in both lists
        for (let key of [...newParams]) {
            if (removeParams.includes(key)) {
                removeParams = removeParams.filter(f => f !== key)
                newParams = newParams.filter(f => f !== key)
            }
        }

        addParams(newParams, removeParams);
    }

    function fetchDataQuality() : Promise<QualityProfile[]> {
        if (dataQuality.length > 0) {
            return new Promise((resolve) => resolve(dataQuality));
        }

        return fetch(import.meta.env.VITE_APP_DATA_QUALITY_URL, {
            method: 'GET'
        }).then(response => response.json()).then(async data => {
            // TODO: fetch only the active instead of all
            // fetch all
            await Promise.all(data.map((profile: QualityProfile) => fetchDqInverse(profile)));

            setDataQuality(data);

            return new Promise((resolve) => resolve(data));
        })
    }

    function fetchDqInverse(profile: QualityProfile) {
        // check if any inverseFilter is present
        for (let cat of profile.categories) {
            if (cat.inverseFilter && cat.inverseFilter !== '') {
                return;
            }
        }

        // not present, fetch
        return fetch(import.meta.env.VITE_APP_DATA_QUALITY_INVERSE_URL + "?qualityProfileId=" + profile.id, {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            for (let cat of profile.categories) {
                cat.inverseFilter = data[cat.label];
            }
        });
    }

    const fetchIndex = async () => {
        let searchTerm = queryString || '';
        if (searchTerm.startsWith('?')) {
            searchTerm = searchTerm.substring(1)
        }

        var pageTerm = page;
        if (searchTerm !== lastSearch) {
            setPage(1)
            pageTerm = 1;
            setLastSearch(searchTerm)
        }

        if (searchTerm === '') {
            return;
        }

        const indexJson = await fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?' + searchTerm + "&pageSize=" + pageSize + "&sort=" + sort + "&dir=" + dir + "&start=" + (pageTerm-1) * pageSize, {
            method: 'GET'
        }).then(response => response.json());

        // setIndexString(JSON.stringify(indexJson, null, 2))
        setResult(indexJson)
    }

    function openCustomizeFilters() {
        setCustomizeFilterModalShow(true)
    }

    function download() {
        navigate('/download/options1?searchParams=' + encodeURIComponent(queryString));
    }

    function api() {
        setApiModalShow(true)
    }

    // the first queryString term will not be removed
    function addParams(fqs : string[], removeFqs: string[]) {
        let term = fqs.length > 0 ? "&" + fqs.join("&") : '';
        let newQuery = queryString + term;
        for (let f of removeFqs) {
            newQuery = newQuery.replace('&' + f, "")
        }

        setQueryString && setQueryString(newQuery)
        // TODO: replace all .pushState with a new URL to this page with updated query parameters
        window.history.pushState({query: newQuery}, 'Occurrence Search', newQuery)
    }

    function doQuickSearch() {
        setQueryString && setQueryString(quickSearch)
        // TODO: replace all .pushState with a new URL to this page with updated query parameters
        window.history.pushState({query: quickSearch}, 'Occurrence Search', quickSearch)
    }

    // TODO: i18n
    return (
        <>
            <div className="container-fluid">
                <div className="container-fluid" id="main-content">
                    <div id="listHeader" className="row justify-content-between">
                        <div className="col-sm-5 col-md-5">
                            <h1>Occurrence records</h1>
                        </div>

                        <div id="searchBoxZ" className="text-right col-sm-4 col-md-4">
                            <div id="advancedSearchLink" className="me-0 float-end">
                                <Link to="/" title="Go to advanced search form">
                                    <i className="bi bi-gear-fill me-1"></i>Advanced Search</Link>
                            </div>
                            <div className="input-group input-group-sm align-content-end">
                                <input type="text" className="form-control mt-2"
                                       value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)}
                                />
                                <button className="btn border-black mt-2"
                                        onClick={() => doQuickSearch()}>Quick Search
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="clearfix row" id="searchInfoRow">
                        <div className="col-md-3 col-sm-3">
                            <div style={{marginBottom: "10px"}}>
                                <div className="btn tooltips border-black btn-sm"
                                     title="Customise the contents of this column"
                                     onClick={() => openCustomizeFilters()}>
                                    <i className="bi bi-gear-fill me-1"></i>Customise filters
                                </div>
                            </div>

                            {customizeFilterModalShow && <CustomizeFilterModal
                                onClose={() => setCustomizeFilterModalShow(false)}
                                facetList={facetList}
                                setFacetList={setFacetList}
                                groupedFacets={groupedFacets}/>}

                            <FacetWell search={queryString} facetList={facetList} groupedFacets={groupedFacets}/>

                        </div>

                        <div className="col-sm-9 col-md-9">
                            <div id="download-button-area" className="float-end">
                                <div id="downloads" className="btn btn-primary btn-sm" title="Download all 100 records"
                                     onClick={() => download()}>
                                    <i className="bi bi-download me-1"></i>Download
                                </div>
                                <div id="downloads" className="btn btn-sm border-black ms-1"
                                     title="Click to view the URL for the JSON version of this search request"
                                     onClick={() => api()}>
                                    <i className="bi bi-file-code me-1"></i>API
                                </div>

                                {apiModalShow && <ApiModal onClose={() => setApiModalShow(false)}
                                                           url={import.meta.env.VITE_OIDC_REDIRECT_URL + '#/occurrence-list?' + queryString}/>}
                            </div>

                            <div style={{height: "40px"}}>
                                <ResultsReturned results={result}
                                                 queryString={queryString}/>
                            </div>

                            <DataQuality dataQuality={dataQuality}
                                         dataQualityInfo={dataQualityInfo}
                                         updateDataQualityInfo={updateDataQualityInfo}
                                         queryString={queryString}
                                         addParams={addParams}/>

                            {/*<div className="btn-group hide" id="template">*/}
                            {/*    <a className="btn btn-default btn-sm" href="" id="taxa_" title="view species page"*/}
                            {/*       target="BIE">placeholder</a>*/}
                            {/*    <button className="btn dropdown-toggle btn-default btn-sm" data-toggle="dropdown"*/}
                            {/*            title="click for more info on this query">*/}
                            {/*        <span className="caret"></span>*/}
                            {/*    </button>*/}

                            {/*    <div className="dropdown-menu" aria-labelledby="taxa_">*/}
                            {/*        <div className="taxaMenuContent">*/}
                            {/*            The search results include records for synonyms and child taxa of*/}
                            {/*            <b className="nameString">placeholder</b> (<span*/}
                            {/*            className="speciesPageLink">link placeholder</span>).*/}

                            {/*            <form name="raw_taxon_search" className="rawTaxonSearch"*/}
                            {/*                  action="/occurrences/search/taxa" method="POST">*/}
                            {/*                <div className="refineTaxaSearch">*/}
                            {/*                    The result set contains records provided under the following names:*/}
                            {/*                    <input type="submit"*/}
                            {/*                           className="btn  btn-default btn-sm rawTaxonSumbit"*/}
                            {/*                           value="Refine search"*/}
                            {/*                           title="Restrict results to the selected names"/>*/}

                            {/*                    <div className="rawTaxaList">placeholder taxa list</div>*/}
                            {/*                </div>*/}
                            {/*            </form>*/}
                            {/*        </div>*/}
                            {/*    </div>*/}
                            {/*</div>*/}

                            <Tabs
                                id="result-tabs"
                                activeKey={tab}
                                onSelect={(k) => setTab(k || '')}
                            >
                                <Tab eventKey="records" title="Records">
                                    <RecordsView results={result}
                                                 pageSize={pageSize} setPageSize={setPageSize}
                                                 sort={sort} setSort={setSort}
                                                 dir={dir} setDir={v => {
                                                     if (typeof v === "function") {
                                                         setDir((old) => (old === "asc" || old === "desc" ? old : "desc"));
                                                     } else {
                                                         setDir(v === "asc" || v === "desc" ? v : "desc");
                                                     }
                                                 }}
                                                 page={page} setPage={setPage}
                                                 queryString={queryString}/>
                                </Tab>
                                <Tab eventKey="map" title="Map">
                                    <MapView queryString={queryString} dataQualityInfo={dataQualityInfo} tab={tab}/>
                                </Tab>
                                <Tab eventKey="charts" title="Charts">
                                    <Charts queryString={queryString} chartsData={chartsData} setChartsData={setChartsData}/>
                                </Tab>
                                <Tab eventKey="images" title="Record images">
                                    <RecordImages queryString={queryString} dataQualityInfo={dataQualityInfo}/>
                                </Tab>
                            </Tabs>
                        </div>
                    </div>


                    {/*<ImageModal />*/}


                </div>
            </div>
        </>
    );
}

export default OccurrenceList;
