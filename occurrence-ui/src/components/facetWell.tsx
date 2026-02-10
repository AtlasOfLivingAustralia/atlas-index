/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import { faCaretDown, faCaretRight, faList } from '@fortawesome/free-solid-svg-icons';
import {useEffect, useState} from "react";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {FacetItem} from "../api/model.tsx";
import MultipleFacets from "./multipleFacets.tsx";

interface FacetWellProps {
    search?: string,
    facetList?: string[],
    groupedFacets?: any[]
}

const flimitValue = 5;

function FacetWell({search, facetList, groupedFacets}: FacetWellProps) {
    const [groupData, setGroupData] = useState<{ [key: string]: {isOpen: boolean, facets: string[]}}>({});
    const [facetData, setFacetData] = useState<{ [key: string]: FacetItem []}>({})
    const [chooseMoreFacet, setChooseMoreFacet] = useState<string | null>(null);

    const intl: IntlShape = useIntl();

    useEffect(() => {
        fetchData()
    }, [search, groupedFacets, facetList])

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
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search' + search + "&pageSize=0&facet=true&facets=" + currentFacet + "&flimit=" + flimitValue + "&fsort=count", {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            if (data.facetResults && data.facetResults.length > 0) {
                let list = data.facetResults[0].fieldResult;
                setFacetData(prevFacetData => ({...prevFacetData, [currentFacet]: list.filter((item: FacetItem) => !item.fq.endsWith('*'))}));
            }

            // fetch next
            fetchNextFacet(flist.slice(1));
        });
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
                    facetsToFetch.push(facet);
                }
            }
            fetchNextFacet(facetsToFetch);
        }
    }

    return <>
        <div id="facetWell" className="card card-body bg-light">
            <h3><FormattedMessage id="search.facets.heading" defaultMessage="Refine results"/></h3>
            {/*<div className="sidebar" style={{clear: "both"}}>*/}
            {/*    <div className="facetGroupName" id="heading_data_quality">*/}
            {/*        Data Profile*/}
            {/*    </div>*/}
            {/*<div className="facetsGroup" id="group_data_quality">*/}
            {/*    <h4><span className="FieldName">Categories</span></h4>*/}
            {/*    <div className="subnavlist nano" style={{clear: "left"}}>*/}
            {/*        <ul className="facets nano-content dq-categories">*/}
            {/*            <li>*/}
            {/*                <a href="/occurrence/search?q=taxa%3A%22forg%22&amp;qualityProfile=ALA&amp;disableQualityFilter=spatially-suspect">*/}
            {/*                    <span className="fa fa-check-square-o">&nbsp;</span><span*/}
            {/*                    className="tooltips"*/}
            {/*                    title="Exclude records with a spatially suspect flag.">Exclude spatially suspect records</span>&nbsp;*/}
            {/*                    <span className="exclude-count-facet"*/}
            {/*                          data-category="spatially-suspect"></span>*/}
            {/*                </a>*/}

            {/*                &nbsp;*/}
            {/*                <span>*/}
            {/*                    <a href="#DQCategoryDetails" className="DQCategoryDetailsLink"*/}
            {/*                       data-profilename="ALA General"*/}
            {/*                       data-dqcategoryname="Exclude spatially suspect records"*/}
            {/*                       data-categorylabel="spatially-suspect"*/}
            {/*                       data-fq="-spatiallyValid:&quot;false&quot;"*/}
            {/*                       data-description="[&quot;Exclude all records where spatial validity is \&quot;false\&quot;&quot;]"*/}
            {/*                       data-translation="{&quot;false&quot;:&quot;Spatially suspect&quot;}"*/}
            {/*                       data-disabled="false"*/}
            {/*                       data-inverse-filter="/occurrence/search?q=taxa%3A%22forg%22&amp;qualityProfile=ALA&amp;disableAllQualityFilters=true&amp;fq=spatiallyValid%3A%22false%22"*/}
            {/*                       data-filters="[&quot;-spatiallyValid:\&quot;false\&quot;&quot;]"*/}
            {/*                       data-dqcategorydescription="Exclude records with a spatially suspect flag."*/}
            {/*                       data-toggle="modal" role="button"><i className="fa fa-info-circle tooltips"*/}
            {/*                                                            title="Click for more information and actions"></i>*/}
            {/*                        &nbsp;*/}
            {/*                        <span className="facet-count">*/}
            {/*                        <i className="fa fa-circle-o-notch fa-spin exclude-loader"></i>*/}
            {/*                        </span>*/}
            {/*                    </a>*/}

            {/*                </span>*/}
            {/*            </li>*/}


            {/*            <li>*/}


            {/*                <a href="/occurrence/search?q=taxa%3A%22forg%22&amp;qualityProfile=ALA&amp;disableQualityFilter=dates-post-1700">*/}
            {/*                    <span className="fa fa-check-square-o">&nbsp;</span><span*/}
            {/*                    className="tooltips"*/}
            {/*                    title="Exclude records with event date pre 1700">Exclude records pre 1700</span>&nbsp;*/}
            {/*                    <span className="exclude-count-facet"*/}
            {/*                          data-category="dates-post-1700"></span>*/}
            {/*                </a>*/}

            {/*                &nbsp;*/}
            {/*                <span>*/}
            {/*                    <a href="#DQCategoryDetails" className="DQCategoryDetailsLink"*/}
            {/*                       data-profilename="ALA General" data-dqcategoryname="Exclude records pre 1700"*/}
            {/*                       data-categorylabel="dates-post-1700" data-fq="-year:[* TO 1700]"*/}
            {/*                       data-description="[&quot;Exclude all records where year is prior to 1700&quot;]"*/}
            {/*                       data-translation="" data-disabled="false"*/}
            {/*                       data-inverse-filter="/occurrence/search?q=taxa%3A%22forg%22&amp;qualityProfile=ALA&amp;disableAllQualityFilters=true&amp;fq=year%3A%5B*+TO+1700%5D"*/}
            {/*                       data-filters="[&quot;-year:[* TO 1700]&quot;]"*/}
            {/*                       data-dqcategorydescription="Exclude records with event date pre 1700"*/}
            {/*                       data-toggle="modal" role="button"><i className="fa fa-info-circle tooltips"*/}
            {/*                                                            title="Click for more information and actions"></i>*/}
            {/*                        &nbsp;*/}
            {/*                        <span className="facet-count">*/}
            {/*                        <i className="fa fa-circle-o-notch fa-spin exclude-loader"></i>*/}
            {/*                        </span>*/}
            {/*                    </a>*/}

            {/*                </span>*/}
            {/*            </li>*/}

            {/*        </ul>*/}
            {/*    </div>*/}

            {/*    <a href="#DQManageFilters" className="multipleFiltersLink" data-toggle="modal"*/}
            {/*       role="button" title="Enable/Disable multiple filters"><span*/}
            {/*        className="glyphicon glyphicon-hand-right"*/}
            {/*        aria-hidden="true"></span>&nbsp;Select filters</a>*/}

            {/*</div>*/}


            {/*<div className="facetGroupName" id="heading_Custom">*/}
            {/*    <a href="#" className="showHideFacetGroup" data-name="Custom"><span*/}
            {/*        className="caret right-caret"></span> Custom</a>*/}
            {/*</div>*/}
            {/*<div className="facetsGroup" id="group_Custom" style="display:none;">*/}
            {/*</div>*/}

            {groupData && Object.keys(groupData).map((groupName, idx) =>
                <div key={idx}>
                    <div className="facetGroupName" onClick={() => toggleGroupOpen(groupName)}>
                        <div><FontAwesomeIconLite icon={groupData[groupName].isOpen ? faCaretDown : faCaretRight} style={{width: '20px'}}/><span>
                            <FormattedMessage id={"facet.group." + groupName} defaultMessage={groupName}/></span></div>
                    </div>

                    {groupData[groupName].isOpen && groupData[groupName].facets.map((facet, idx) =>
                        <div key={idx} style={{marginLeft: '5px'}}>
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
                        </div>
                    )}
                </div>
            )}

        </div>

        { chooseMoreFacet && <MultipleFacets queryString={search || ''} facet={chooseMoreFacet} onClose={() => setChooseMoreFacet(null)}/> }

    </>
}

export default FacetWell;
