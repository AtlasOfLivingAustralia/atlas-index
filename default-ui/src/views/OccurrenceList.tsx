import {useContext, useEffect, useState} from "react";
import {Breadcrumb, DataQualityInfo, ListsUser, QualityProfile} from "../api/sources/model.ts";
import MapView from "../components/occurrence/mapView.tsx";
import RecordsView from "../components/occurrence/recordsView.tsx";
import ResultsReturned from "../components/occurrence/resultsReturned.tsx";
import RecordImages from "../components/occurrence/recordImages.tsx";
import FacetWell from "../components/occurrence/facetWell.tsx";
import {Link} from "react-router-dom";
import {Tab, Tabs} from "react-bootstrap";
import Charts from "../components/occurrence/charts.tsx";
import ApiModal from "../components/occurrence/apiModal.tsx";
import CustomizeFilterModal from "../components/occurrence/customizeFilterModal.tsx";
import DataQuality from "../components/occurrence/dataQuality.tsx";
import UserContext from "../helpers/UserContext.ts";
import {cacheFetchJson} from "../helpers/CacheFetch.tsx";

function OccurrenceList({setBreadcrumbs, queryString, setQueryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string,
    setQueryString?: (value: (((prevState: string) => string) | string)) => void
}) {
    const currentUser = useContext(UserContext) as ListsUser;

    const [tab, setTab] = useState('records');

    // quick search
    const [quickSearch, setQuickSearch] = useState('');

    // searching
    const [lastSearch, setLastSearch] = useState('');
    const [result, setResult] = useState({});
    const [pageSize, setPageSize] = useState(20);
    const [sort, setSort] = useState('first_loaded_date');
    const [dir, setDir] = useState('desc');
    const [page, setPage] = useState(1);

    // facets
    const [groupedFacets, setGroupedFacets] = useState([])
    const [facetList, setFacetList] = useState(['kingdom', 'basisOfRecord'])

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

    useEffect(() => {
        fetchGroupedFacets();

        fetchDataQuality();

        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
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
        if (!currentUser?.user()) {
            // TODO: load from local storage

            updateAndSaveDataQualityInfoWithQueryString(dqList);
        } else {
            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property", {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
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

    function fetchGroupedFacets() {
        if (groupedFacets.length > 0) {
            return;
        }

        fetch(import.meta.env.VITE_APP_GROUPED_FACETS_URL, {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            setGroupedFacets(data);
        })
    }

    function fetchDataQuality() : Promise<QualityProfile[]> {
        if (dataQuality.length > 0) {
            return new Promise((resolve) => resolve(dataQuality));
        }

        return fetch(import.meta.env.VITE_APP_DATA_QUALITY_URL, {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            setDataQuality(data);

            return new Promise((resolve) => resolve(data));
        })
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

        const indexJson = await cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?' + searchTerm + "&pageSize=" + pageSize + "&sort=" + sort + "&dir=" + dir + "&start=" + (pageTerm-1) * pageSize, {
            method: 'GET'
        }, null);

        // setIndexString(JSON.stringify(indexJson, null, 2))
        setResult(indexJson)
    }

    function openCustomizeFilters() {
        setCustomizeFilterModalShow(true)
    }

    function download() {
        console.log("download")
    }

    function api() {
        setApiModalShow(true)
    }

    function addFq(fq : string) {
        let term = "&fq=" + fq;
        setQueryString && setQueryString(queryString + term)
        window.history.pushState({query: queryString + term}, 'Occurrence Search', "#/occurrence-list?" + queryString + term)
    }

    // the first queryString term will not be removed
    function addParams(fqs : string[], removeFqs: string[]) {
        let term = fqs.length > 0 ? "&" + fqs.join("&") : '';
        let newQuery = queryString + term;
        for (let f of removeFqs) {
            newQuery = newQuery.replace('&' + f, "")
        }

        setQueryString && setQueryString(newQuery)
        window.history.pushState({query: newQuery}, 'Occurrence Search', "#/occurrence-list?" + newQuery)
    }

    function doQuickSearch() {
        setQueryString && setQueryString(quickSearch)
        window.history.pushState({query: quickSearch}, 'Occurrence Search', "#/occurrence-list?" + quickSearch)
    }

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
                                <Link to="/occurrence-search" title="Go to advanced search form">
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

                            <FacetWell search={queryString} facetList={facetList} groupedFacets={groupedFacets}
                                       addFq={addFq}/>
                            {/*<MultipleFacets />*/}

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
                                                 dir={dir} setDir={setDir}
                                                 page={page} setPage={setPage}
                                                 queryString={queryString}/>
                                </Tab>
                                <Tab eventKey="map" title="Map">
                                    <MapView queryString={queryString} dataQualityInfo={dataQualityInfo} tab={tab}/>
                                </Tab>
                                <Tab eventKey="charts" title="Charts">
                                    <Charts search={queryString}/>
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
