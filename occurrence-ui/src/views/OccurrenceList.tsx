/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, useUser} from "@ala/common-ui";
import {useEffect, useState} from "react";
import { FormattedMessage, useIntl } from 'react-intl';
import { DataQualityInfo, OccurrenceListResult, QualityProfile } from '../api/model.tsx';
import MapView from "../components/mapView.tsx";
import RecordsView from "../components/recordsView.tsx";
import ResultsReturned from "../components/resultsReturned.tsx";
import RecordImages from "../components/recordImages.tsx";
import FacetWell from "../components/facetWell.tsx";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {Tab, Tabs} from "react-bootstrap";
import Charts from "../components/charts.tsx";
import ApiModal from "../components/apiModal.tsx";
import CustomizeFilterModal from "../components/customizeFilterModal.tsx";
import DataQuality from "../components/dataQuality.tsx";
import ActiveFilters from "../components/activeFilters.tsx";
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
    const [result, setResult] = useState<OccurrenceListResult>({ occurrences: [], totalRecords: 0 });
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
        expand: false
    })

    // modals
    const [apiModalShow, setApiModalShow] = useState(false);
    const [customizeFilterModalShow, setCustomizeFilterModalShow] = useState(false);

    const navigate = useNavigate();
    const intl = useIntl();
    const location = useLocation();

    // Derive queryString from React Router's location so it updates on every
    // client-side navigation (including navigate() calls from OccurrenceSearch).
    const [queryString, setQueryString] = useState<string>(() => {
        const qs = location.search;
        if (!qs) return '';
        const urlParams = new URLSearchParams(qs.startsWith('?') ? qs.substring(1) : qs);
        urlParams.delete('pageSize');
        urlParams.delete('sort');
        urlParams.delete('dir');
        urlParams.delete('order');
        urlParams.delete('start');
        return '?' + urlParams.toString();
    });

    // Re-sync queryString (and reload DQ profile) whenever the URL changes.
    useEffect(() => {
        const qs = location.search;
        const urlParams = new URLSearchParams(qs.startsWith('?') ? qs.substring(1) : qs);
        urlParams.delete('pageSize');
        urlParams.delete('sort');
        urlParams.delete('dir');
        urlParams.delete('order');
        urlParams.delete('start');
        const next = '?' + urlParams.toString();
        setQueryString(next);
        fetchDataQuality().then(dqList => loadDqProfile(dqList));

        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
            {title: 'Search results', href: '/occurrence-list'},
        ]);
    }, [location.search]);

    useEffect(() => {
        // Block until DQ profile redirect has happened — qualityProfile or
        // disableAllQualityFilters must be present before we fire any searches.
        if (!queryString?.includes("qualityProfile=") && !queryString?.includes("disableAllQualityFilters=")) {
            return;
        }
        fetchIndex();
    }, [pageSize, sort, dir, page, queryString]);

    function loadDqProfile(dqList: QualityProfile []) {
        if (!userInfo?.authenticated) {
            const stored = localStorage.getItem(import.meta.env.VITE_APP_NAME + ".dqUserProfile");
            if (stored) {
                const data = JSON.parse(stored);
                dataQualityInfo.profile = data.disableAll ? 'disable' : (data.dataProfile || import.meta.env.VITE_APP_DQ_DEFAULT_PROFILE);
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
            }

            updateAndSaveDataQualityInfoWithQueryString(dqList);
        } else {
            fetch(import.meta.env.VITE_APP_API_URL + "/v2/user/property?key=dq", {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + userInfo?.accessToken,
                    'Accept': 'application/json'
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch DQ profile: ' + response.status);
                }
                return response.json();
            }).then(raw => {
                const data = JSON.parse(raw['dq']); // throws
                dataQualityInfo.profile = data.disableAll ? 'disable' : (data.dataProfile || import.meta.env.VITE_APP_DQ_DEFAULT_PROFILE || 'ALA');
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
            }).catch(() => {
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
            // No DQ params in URL — apply the default profile unless one was already
            // resolved from user preferences (stored/fetched). Fall back to env default.
            if (dataQualityInfo.profile === 'disable') {
                dataQualityInfo.profile = import.meta.env.VITE_APP_DQ_DEFAULT_PROFILE || 'ALA';
            }
            dataQualityInfo.selectedFilters = initDqFilters(dqList, dataQualityInfo.profile);

            // Inject the default DQ params into queryString so all sub-components see them
            const defaultParams: string[] = ['qualityProfile=' + dataQualityInfo.profile];
            for (let dq of dqList) {
                if (dq.shortName === dataQualityInfo.profile) {
                    for (let cat of dq.categories) {
                        if (dataQualityInfo.selectedFilters !== undefined && !dataQualityInfo.selectedFilters.includes(cat.label)) {
                            defaultParams.push('disableQualityFilter=' + cat.label);
                        }
                    }
                }
            }
            const base = queryString && queryString !== '?' ? queryString : '?';
            const newQuery = base + (base.endsWith('?') ? '' : '&') + defaultParams.join('&');

            // Reload page. setQueryString is not flowing to all components as expected
            window.location.replace(newQuery);
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
        const cacheKey = import.meta.env.VITE_APP_NAME + '.dqProfiles';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached) as QualityProfile[];
            setDataQuality(data);
            return Promise.resolve(data);
        }

        return fetch(import.meta.env.VITE_APP_DATA_QUALITY_URL, {
            method: 'GET'
        }).then(response => response.json()).then(async data => {
            // fetch all, could also make a change that only retrieves the active profile
            await Promise.all(data.map((profile: QualityProfile) => fetchDqInverse(profile)));

            sessionStorage.setItem(cacheKey, JSON.stringify(data));
            setDataQuality(data);

            return data as QualityProfile[];
        });
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

        // Reload page. setQueryString is not flowing to all components as expected
        window.location.replace(newQuery);
    }

    function removeFq(fq: string) {
        const params = new URLSearchParams(queryString.startsWith('?') ? queryString.substring(1) : queryString);
        if (fq === 'wkt') {
            params.delete('wkt');
        } else if (fq === 'radius') {
            params.delete('radius');
            params.delete('lat');
            params.delete('lon');
        } else {
            // delete only the matching fq value, leaving others intact
            const remaining = params.getAll('fq').filter(f => f !== fq);
            params.delete('fq');
            remaining.forEach(f => params.append('fq', f));
        }
        const newQuery = '?' + params.toString();
        setQueryString && setQueryString(newQuery);
        window.history.pushState({query: newQuery}, 'Occurrence Search', newQuery);
    }

    function clearAllFq() {
        const params = new URLSearchParams(queryString.startsWith('?') ? queryString.substring(1) : queryString);
        params.delete('fq');
        params.delete('wkt');
        params.delete('radius');
        params.delete('lat');
        params.delete('lon');
        const newQuery = '?' + params.toString();
        setQueryString && setQueryString(newQuery);
        window.history.pushState({query: newQuery}, 'Occurrence Search', newQuery);
    }

    function doQuickSearch() {
        // Reload page. setQueryString is not flowing to all components as expected
        window.location.replace(quickSearch);
    }

    return (
        <>
            <div className="container-fluid">
                <div className="container-fluid" id="main-content">
                    <div id="listHeader" className="row justify-content-between">
                        <div className="col-sm-5 col-md-5">
                            <h1><FormattedMessage id={'search.heading.list'} defaultMessage={'Occurrence records'}/> </h1>
                        </div>

                        <div id="searchBoxZ" className="text-right col-sm-4 col-md-4">
                            <div id="advancedSearchLink" className="me-0 float-end">
                                <Link to="/" title={intl.formatMessage({id: 'list.advancedsearchlink.tooltip', defaultMessage: "Go to advanced search form"})}>
                                    <i className="bi bi-gear-fill me-1"></i><FormattedMessage id='list.advancedsearchlink.navigator' defaultMessage={'Advanced search'}/> </Link>
                            </div>
                            <div className="input-group input-group-sm align-content-end">
                                <input type="text" className="form-control mt-2"
                                       value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)}
                                />
                                <button className="btn btn-outline-dark mt-2"
                                        onClick={() => doQuickSearch()}><FormattedMessage id={'list.advancedsearchlink.button.label'} defaultMessage={'Quick saerch'}/>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="clearfix row" id="searchInfoRow">
                        <div className="col-md-3 col-sm-3">
                            <div style={{marginBottom: "10px"}}>
                                <div className="btn tooltips btn-outline-dark btn-sm"
                                     title={intl.formatMessage({id:'search.filter.customise.title', defaultMessage:"Customise the contents of this column"})}
                                     onClick={() => openCustomizeFilters()}>
                                    <i className="bi bi-gear-fill me-1"></i><FormattedMessage id={'search.filter.customise'} defaultMessage={'Customise filters'}/>
                                </div>
                            </div>

                            {customizeFilterModalShow && <CustomizeFilterModal
                                onClose={() => setCustomizeFilterModalShow(false)}
                                facetList={facetList}
                                setFacetList={setFacetList}
                                groupedFacets={groupedFacets}/>}

                            <FacetWell search={queryString} facetList={facetList} groupedFacets={groupedFacets}
                                       dataQuality={dataQuality} dataQualityInfo={dataQualityInfo}
                                       updateDataQualityInfo={updateDataQualityInfo} addParams={addParams}/>
                        </div>

                        <div className="col-sm-9 col-md-9">
                            <div className="row g-0 align-items-start mb-3">
                                <div className="col">
                                    <ResultsReturned results={result} queryString={queryString}/>
                                </div>
                                <div id="download-button-area" className="col-auto pe-0">
                                    <div id="downloads" className="btn btn-primary btn-sm"
                                         title={intl.formatMessage({id:'list.downloads.navigator.title', defaultMessage:"Download all {recordCount} records"}, {recordCount: result.totalRecords})}
                                         onClick={() => download()}>
                                        <i className="bi bi-download me-1"></i><FormattedMessage id={'list.downloads.navigator'} defaultMessage={'Download'}/>
                                    </div>
                                    <div id="downloads" className="btn btn-sm btn-outline-dark ms-1"
                                         title={intl.formatMessage({id: 'list.copylinks.dlg.copybutton.title', defaultMessage: "Click to view the URL for the JSON version of this search request"})}
                                         onClick={() => api()}>
                                        <i className="bi bi-file-code me-1"></i>API
                                    </div>
                                    {apiModalShow && <ApiModal onClose={() => setApiModalShow(false)}
                                                               url={import.meta.env.VITE_OIDC_REDIRECT_URL + '#/occurrence-list?' + queryString}/>}
                                </div>
                            </div>

                            <DataQuality dataQuality={dataQuality}
                                         dataQualityInfo={dataQualityInfo}
                                         updateDataQualityInfo={updateDataQualityInfo}
                                         queryString={queryString}
                                         addParams={addParams}/>

                            <ActiveFilters
                                queryString={queryString}
                                onRemove={removeFq}
                                onClearAll={clearAllFq}
                            />

                            <Tabs id="result-tabs" activeKey={tab} onSelect={(k) => setTab(k || '')}>
                                <Tab eventKey="records" title={intl.formatMessage({id: 'list.link.t1', defaultMessage: "Records"})}>
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
                                <Tab eventKey="map" title={intl.formatMessage({id: 'list.link.t2', defaultMessage: "Map"})}>
                                    <MapView queryString={queryString} dataQualityInfo={dataQualityInfo} tab={tab}/>
                                </Tab>
                                <Tab eventKey="charts" title={intl.formatMessage({id: 'list.link.t3', defaultMessage: "Charts"})}>
                                    <Charts queryString={queryString} chartsData={chartsData} setChartsData={setChartsData}/>
                                </Tab>
                                <Tab eventKey="images" title={intl.formatMessage({id: 'list.link.t5', defaultMessage: "Record images"})}>
                                    <RecordImages queryString={queryString} dataQualityInfo={dataQualityInfo}/>
                                </Tab>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default OccurrenceList;
