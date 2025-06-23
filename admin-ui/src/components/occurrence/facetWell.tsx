import {useEffect, useState} from "react";
import {GroupedFacetData} from "../../api/sources/model.ts";
import {cacheFetchJson} from "../../helpers/CacheFetch.tsx";

interface FacetWellProps {
    search?: string,
    facetList?: string[],
    groupedFacets?: any[],
    addFq: (fq: string) => void
}

function FacetWell({search, facetList, groupedFacets, addFq}: FacetWellProps) {
    const [groupedFacetData, setGroupedFacetData] = useState<GroupedFacetData>({})

    const fetchController = new AbortController();

    useEffect(() => {
        // setGroupedFacetData({})
        fetchData()
    }, [search, groupedFacets, facetList])

    function fetchData() {
        if (!groupedFacets || groupedFacets.length == 0) {
            return;
        }

        if (search === '') {
            return;
        }

        // remove know fq's from facet list
        let flist: string[] = []
        if (facetList) {
            flist = facetList.filter(f => {
                let regex = new RegExp("\\b" + f + "\\b");
                return !regex.test(search || '');
            })
        }

        if (flist.length == 0) {
            setGroupedFacetData({})
            return;
        }

        cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?' + search + "&pageSize=0&facet=true&facets=" + flist?.join(','), {
            method: 'GET',
            signal: fetchController.signal
        }, null).then(data => {
            let groups: GroupedFacetData = {}
            for (let group of groupedFacets) {
                for (let f of group.facets) {
                    for (let facet of data.facetResults) {
                        if (f.field === facet.fieldName) {
                            groups[group.title] = groups[group.title] || []
                            groups[group.title].push({label: facet.fieldName, facets: facet.fieldResult})
                        }
                    }
                }
            }
            setGroupedFacetData(groups)
        })
    }

    function filterBy(fq: string) {
        addFq(fq)
    }

    function chooseMore(label: string) {
        console.log('choose more', label)
    }

    return <>
        <div id="facetWell" className="card card-body bg-light">
            <h3>Narrow your results</h3>
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

            {/*<pre>{facetData && JSON.stringify(facetData, null, 2)}</pre>*/}

            {groupedFacetData && Object.keys(groupedFacetData).map((groupName, idx) =>
                <div key={idx}>
                    <div className="facetGroupName">
                        <div><i className="bi bi-caret-down-fill"></i>&nbsp;<span>{groupName}</span></div>
                    </div>

                    {groupedFacetData[groupName].map((facet, idx) =>
                        <div key={idx}>
                            <div className="facetsGroup" id={"group_" + facet.label}>
                                <h4><span className="FieldName">{facet.label}</span></h4>
                                <div className="subnavlist nano" style={{clear: "left"}}>
                                    <ul className="facets nano-content">
                                        {facet.facets.map((item: any, idx) =>
                                            <li key={idx}>
                                                <div className="facet-item"
                                                     title={"Filter results by " + facet.label}
                                                     onClick={() => filterBy(item.fq)}>
                                                    <i className="bi bi-square me-1"></i><span>{item.label} ({item.count})</span>
                                                </div>
                                            </li>
                                        )}
                                    </ul>
                                </div>


                                <div className="showHide">
                                    <div className="multipleFacetsLink"
                                         title="See more options or refine with multiple values"
                                         onClick={() => chooseMore(facet.label)}>
                                        <i className="bi bi-list-check"></i> choose more...
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>

    </>
}

export default FacetWell;
