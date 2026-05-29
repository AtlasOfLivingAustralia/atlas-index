/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import { faCaretDown, faCaretRight, faList } from '@fortawesome/free-solid-svg-icons';
import {useEffect, useState} from "react";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {DataQualityInfo, FacetItem, OccurrenceListResult, QualityCategory, QualityProfile} from "../../api/model.tsx";
import {getQc} from "../../util/util.tsx";
import MultipleFacets from "./multipleFacets.tsx";
import DataQualityFiltersModal from "./dataQualityFiltersModal.tsx";
import { fetchDqCountsSequentially } from "../../util/dqCache.ts";

interface FacetWellProps {
    search?: string,
    facetList?: string[],
    groupedFacets?: any[],
    dataQuality?: QualityProfile[],
    dataQualityInfo?: DataQualityInfo,
    updateDataQualityInfo?: (dataQualityInfo: DataQualityInfo) => void,
    addParams?: (fqs: string[], removeFqs: string[]) => void,
    result?: OccurrenceListResult
}

const flimitValue = 5;

function FacetWell({search, facetList, groupedFacets, dataQuality, dataQualityInfo, updateDataQualityInfo, addParams, result}: FacetWellProps) {
    const [groupData, setGroupData] = useState<{ [key: string]: {isOpen: boolean, facets: string[]}}>({});
    const [facetData, setFacetData] = useState<{ [key: string]: FacetItem []}>({})
    const [chooseMoreFacet, setChooseMoreFacet] = useState<string | null>(null);
    const [dqOpen, setDqOpen] = useState(() => {
        const stored = localStorage.getItem('facetGroupOpen_dataProfile');
        return stored === null ? false : stored === 'true';
    });
    const [dqCounts, setDqCounts] = useState<{ [label: string]: number | undefined }>({});
    const [dqProfile, setDqProfile] = useState<string | undefined>();
    const [showFilters, setShowFilters] = useState(false);
    const [noRecords, setNoRecords] = useState(false);

    const intl: IntlShape = useIntl();

    // DQ helpers
    const activeProfile = dataQuality?.find(dq => dq.shortName === dataQualityInfo?.profile);

    function isDqFilterSelected(cat: QualityCategory): boolean {
        return (dataQualityInfo?.selectedFilters === undefined || dataQualityInfo.selectedFilters.includes(cat.label)) &&
            !(search?.includes("disableQualityFilter=" + cat.label + "&") ||
                search?.endsWith("disableQualityFilter=" + cat.label));
    }

    function toggleDqFilter(cat: QualityCategory) {
        if (!updateDataQualityInfo || !dataQualityInfo) return;
        const selected = dataQualityInfo.selectedFilters || [];
        if (isDqFilterSelected(cat)) {
            updateDataQualityInfo({ ...dataQualityInfo, selectedFilters: selected.filter(f => f !== cat.label) });
        } else {
            updateDataQualityInfo({ ...dataQualityInfo, selectedFilters: [...selected, cat.label] });
        }
    }

    useEffect(() => {
        if (!activeProfile || !search || !result?.totalRecords || !dqOpen) {
            return;
        }

        // if profile changed, reset counts
        if (dqProfile !== activeProfile.shortName) {
            setDqProfile(activeProfile.shortName);

            const newCounts: { [label: string]: number | undefined } = {};
            activeProfile.categories.forEach(cat => { newCounts[cat.label] = undefined; });
            setDqCounts(newCounts);
        }

        fetchDqCountsSequentially(
            import.meta.env.VITE_APP_BIOCACHE_URL,
            search,
            activeProfile.categories,
            (label: string, count: number) => setDqCounts(prev => ({ ...prev, [label]: count }))
        );
    }, [search, dataQualityInfo?.profile, result?.totalRecords, dqOpen]);

    useEffect(() => {
        if (!search || !groupedFacets || !facetList || !result?.totalRecords) {
            return;
        }

        fetchData()
    }, [search, groupedFacets, facetList, result?.totalRecords])


    function lookupIsOpen(groupName: string): boolean {
        // lookup local storage value
        let lsKey = "facetGroupOpen_" + groupName;
        let lsValue = localStorage.getItem(lsKey);
        if (lsValue === null) {
            return false; // default to closed
        }
        return lsValue === "true";
    }

    function fetchData() {
        if (!groupedFacets || groupedFacets.length == 0) {
            return;
        }

        if (search === '') {
            return;
        }

        // remove known fq's from facet list
        let flist: string[] = []
        if (facetList) {
            flist = facetList.filter(f => {
                let regex = new RegExp("\\b" + f + "\\b");
                return !regex.test(search || '');
            })
        }

        // build groups of facets to fetch
        let facetsToFetch: string[] = [];
        let groups: { [key: string]: {isOpen: boolean, facets: string []}} = {};
        for (let group of groupedFacets) {
            for (let f of group.facets) {
                for (let facet of flist) {
                    if (f.field === facet) {
                        groups[group.title] = groups[group.title] || {isOpen: lookupIsOpen(group.title), facets: []};
                        groups[group.title].facets.push(facet);

                        if (groups[group.title].isOpen) {
                            facetsToFetch.push(facet);
                        }
                    }
                }
            }
        }
        setGroupData(groups)
        setFacetData({}) // reset counts and lists

        fetchNextFacet(facetsToFetch);
    }

    function fetchNextFacet(flist: string[]) {
        if (flist.length == 0) {
            return;
        }

        if (search === '') {
            return;
        }

        const currentFacet = flist[0];
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search' + search + "&pageSize=0&facet=true&facets=" + currentFacet + "&flimit=" + flimitValue + "&fsort=count" + getQc(), {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            // must check totalRecords after this fetch as it is done concurrently with the parent component fetches
            if (data.totalRecords == 0) {
                addEmptyFacets(flist);
                setNoRecords(true);

                return;
            }

            if (data.facetResults && data.facetResults.length > 0) {
                let list = data.facetResults[0].fieldResult;
                setFacetData(prevFacetData => ({...prevFacetData, [currentFacet]: list.filter((item: FacetItem) => !item.fq.endsWith('*'))}));
            } else {
                setFacetData(prevFacetData => ({...prevFacetData, [currentFacet]: []}));
            }

            // fetch next
            fetchNextFacet(flist.slice(1));
        });
    }

    // set all remaining facets as empty so spinners resolve, do not fetch next
    function addEmptyFacets(flist: string[]) {
        let emptyFacetData: { [key: string]: FacetItem[] } = {};
        for (let facet of flist) {
            emptyFacetData[facet] = [];
        }

        setFacetData(prevFacetData => ({...prevFacetData, ...emptyFacetData}));
    }

    function chooseMore(label: string) {
        setChooseMoreFacet(label);
    }

    function toggleGroupOpen(groupName: string) {
        let isOpen = !groupData[groupName].isOpen;
        let lsKey = "facetGroupOpen_" + groupName;
        localStorage.setItem(lsKey, isOpen ? "true" : "false");

        setGroupData(prevGroupData => ({
            ...prevGroupData,
            [groupName]: {
                ...prevGroupData[groupName],
                isOpen: isOpen
            }
        }));

        // if now open, and no data, fetch
        if (isOpen) {
            let facetsToFetch: string[] = [];
            for (let facet of groupData[groupName].facets) {
                if (!facetData[facet]) {
                    if (noRecords) {
                        addEmptyFacets(groupData[groupName].facets);
                    } else {
                        facetsToFetch.push(facet);
                    }
                }
            }
            fetchNextFacet(facetsToFetch);
        }
    }

    return <>
        <div id="facetWell" className="card card-body bg-light">
            <h3><FormattedMessage id="search.facets.heading" defaultMessage="Refine results"/></h3>

            {/* Data Profile section */}
            {dataQuality && dataQuality.length > 0 && dataQualityInfo?.profile !== 'disable' && activeProfile && <>
                <div className="facetGroupName" onClick={() => {
                    const next = !dqOpen;
                    localStorage.setItem('facetGroupOpen_dataProfile', String(next));
                    setDqOpen(next);
                }} style={{ cursor: 'pointer' }}>
                    <div>
                        <FontAwesomeIconLite icon={dqOpen ? faCaretDown : faCaretRight} style={{width: '20px'}}/>
                        <span><FormattedMessage id="quality.filters.group.title" defaultMessage="Data Profile"/></span>
                    </div>
                </div>

                {dqOpen && <div>
                    <div className="facetsGroup">
                        <h4><span className="FieldName" style={{ marginLeft: '5px' }}>
                            <FormattedMessage id="facet.group.dq.categories" defaultMessage="Categories"/>
                        </span></h4>
                        <ul className="facets">
                            {activeProfile.categories.map((cat: QualityCategory, idx: number) => {
                                const selected = isDqFilterSelected(cat);
                                const count = dqCounts[cat.label];
                                return (
                                    <li key={idx} style={{ cursor: 'pointer' }} onClick={() => toggleDqFilter(cat)}>
                                        <span title={cat.description} className="facet-item">
                                            <i className={`bi ${selected ? 'bi-check-square' : 'bi-square'} me-1`}></i>
                                            <span>{cat.name}</span>
                                            {count !== undefined
                                                ? <span className="ms-1">({selected ? '-' + intl.formatNumber(count) : '0'})</span>
                                                : <span className="spinner-border ms-1" role="status" style={{ width: '0.8em', height: '0.8em', borderWidth: '0.1em' }}/>
                                            }
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>}

                {showFilters && addParams && dataQualityInfo && updateDataQualityInfo && <DataQualityFiltersModal
                    onClose={() => setShowFilters(false)}
                    queryString={search}
                    dataQualityInfo={dataQualityInfo}
                    updateDataQualityInfo={updateDataQualityInfo}
                    dataQuality={dataQuality}
                    addParams={addParams}/>}
            </>}

            {groupData && Object.keys(groupData).map((groupName, idx) =>
                <div key={idx}>
                    <div className="facetGroupName" onClick={() => toggleGroupOpen(groupName)}>
                        <div><FontAwesomeIconLite icon={groupData[groupName].isOpen ? faCaretDown : faCaretRight} style={{width: '20px'}}/><span>
                            <FormattedMessage id={"facet.group." + groupName} defaultMessage={groupName}/></span></div>
                    </div>

                    {groupData[groupName].isOpen && groupData[groupName].facets.map((facet, idx) =>
                        <div key={idx}>
                            {(!Array.isArray(facetData[facet]) || facetData[facet].length > 0) &&
                                <div className="facetsGroup" id={"group_" + facet}>
                                    <h4><span className="FieldName" style={{ marginLeft: '5px'}}><FormattedMessage id={"facet." + facet} defaultMessage={facet}/></span></h4>
                                    <div className="subnavlist nano" style={{clear: "left"}}>
                                        <ul className="facets nano-content">
                                            {Array.isArray(facetData[facet]) ? facetData[facet].map((item: { fq: string; label: string; count: number, i18nCode: string }, idx) =>
                                                <li key={idx}>
                                                    <a className="facet-item"
                                                       title={"Filter results by " + item.label}
                                                       href={'/occurrences/search' + (search || '') + '&fq=' + encodeURIComponent(item.fq)}>
                                                        <i className="bi bi-square me-1"></i><span><FormattedMessage id={item.i18nCode} defaultMessage={item.label}/> ({intl.formatNumber(item.count)})</span>
                                                    </a>
                                                </li>
                                            ) : <div className="spinner-border" style={{width:'14px', height: '14px'}}/>}
                                        </ul>
                                    </div>

                                    {facetData[facet] && facetData[facet].length >= flimitValue &&
                                        <div className="multipleFacetsLink"
                                             title={intl.formatMessage({id: 'search.facets.see.more.options'})}
                                             onClick={() => chooseMore(facet)}>
                                            <FontAwesomeIconLite icon={faList}/> <FormattedMessage id='facets.facetfromgroup.link' defaultMessage='choose more...'/>
                                        </div>
                                    }
                                </div>
                            }

                        </div>
                    )}
                </div>
            )}

        </div>

        { chooseMoreFacet && <MultipleFacets queryString={search || ''} facet={chooseMoreFacet} onClose={() => setChooseMoreFacet(null)}/> }

    </>
}

export default FacetWell;
