/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Fragment, useEffect, useState} from 'react';
import classes from './search.module.css';
import {useNavigate} from 'react-router-dom';
import {speciesDefn} from './props/speciesDefn.tsx';
import {datasetsDefn} from './props/datasetsDefn.tsx';
import {dataprojectsDefn} from './props/dataprojectsDefn.tsx';
import {specieslistDefn} from './props/specieslistDefn.tsx';
import {environmentallayersDefn} from './props/environmentallayersDefn.tsx';
import {regionslocalitiesDefn} from './props/regionslocalitiesDefn.tsx';
import {articlesDefn} from './props/articlesDefn.tsx';
import {Examples} from './examples.tsx';
import {GenericViewProps} from '../../api/sources/model.ts';
import {ArrowRightIcon, ListIcon, TileIcon} from '@ala/common-ui';

interface ViewProps {
    queryString?: string | null;
    setQuery: (query: string) => void;
    setTab: (tab: string) => void;
    isMobile: boolean;
}

type SearchGroupType = {
    [key: string]: {
        label: string;
        fq: string;
        types: string[];
        defn: GenericViewProps;
        count?: number;
        items?: any[];
    };
};

const searchGroupsTemplate: SearchGroupType = {
    species: {
        label: 'Species',
        fq: 'idxtype:TAXON OR idxtype:COMMON',
        types: ['TAXON', 'COMMON'],
        defn: speciesDefn,
        count: 0,
        items: []
    },
    datasets: {
        label: 'Datasets',
        fq: 'idxtype:DATARESOURCE OR idxtype:DATAPROVIDER OR idxtype:INSTITUTION OR idxtype:COLLECTION',
        types: ['DATARESOURCE', 'DATAPROVIDER', 'INSTITUTION', 'COLLECTION'],
        defn: datasetsDefn,
        count: 0,
        items: []
    },
    specieslists: {
        label: 'Species lists',
        fq: 'idxtype:SPECIESLIST',
        types: ['SPECIESLIST'],
        defn: specieslistDefn,
        count: 0,
        items: []
    },
    projects: {
        label: 'Data projects',
        fq: 'idxtype:BIOCOLLECT OR idxtype:DIGIVOL',
        types: ['BIOCOLLECT', 'DIGIVOL'],
        defn: dataprojectsDefn,
        count: 0,
        items: []
    },
    layers: {
        label: 'Spatial layers',
        fq: 'idxtype:LAYER',
        types: ['LAYER'],
        defn: environmentallayersDefn,
        count: 0,
        items: []
    },
    locations: {
        label: 'Locations',
        fq: 'idxtype:REGION OR idxtype:LOCALITY',
        types: ['REGION', 'LOCALITY'],
        defn: regionslocalitiesDefn,
        count: 0,
        items: []
    },
    articles: {
        label: 'Help and general content',
        fq: 'idxtype:WORDPRESS OR idxtype:KNOWLEDGEBASE',
        types: ['WORDPRESS', 'KNOWLEDGEBASE'],
        defn: articlesDefn,
        count: 0,
        items: []
    }
}

const groupLookup: { [key: string]: string } = {}
for (const groupKey in searchGroupsTemplate) {
    const group = searchGroupsTemplate[groupKey];
    for (const type of group.types) {
        groupLookup[type] = groupKey;
    }
}

function AllView({queryString, setQuery, setTab, isMobile}: ViewProps) {
    const [filter, setFilter] = useState(
        () => localStorage.getItem('searchView') || 'list'
    );
    const [groups, setGroups] = useState<any[]>([]);
    const [total, setTotal] = useState<number>(0);

    const navigate = useNavigate();

    useEffect(() => {
        // reset groups
        setGroups([]);

        // reset total
        setTotal(-1);

        if (!queryString) {
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/search?q=' + encodeURIComponent(queryString as string) + '&facets=idxtype&pageSize=0')
            .then((response) => response.json())
            .then((data) => {
                // copy template and reset counts
                let searchGroups: SearchGroupType = {};
                for (const groupKey in searchGroupsTemplate) {
                    searchGroups[groupKey] = {
                        ...searchGroupsTemplate[groupKey],
                        count: 0,
                        items: []
                    };
                }
                if (data?.facetResults && data.facetResults[0] && data.facetResults[0].fieldResult) {
                    data.facetResults[0].fieldResult.forEach((facet: any) => {
                        var group: string | undefined = groupLookup[facet.label];
                        if (group) {
                            searchGroups[group].count = searchGroups[group].count + facet.count;
                        }
                    });
                }

                setTotal(data.totalRecords);

                // fetch the first 4 results for each
                Object.values(searchGroups).forEach((group: any) => {
                    if (group.count > 0) {
                        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/search?q=' + encodeURIComponent(queryString as string) +
                            '&pageSize=4&fq=' + encodeURIComponent(group.fq || '')
                        )
                            .then((response) => response.json())
                            .then((data) => {
                                if (data?.searchResults) {
                                    var list: any[] = [];
                                    data.searchResults.forEach((result: any) => {
                                        list.push(result);
                                    });

                                    setGroups((prevGroups) => prevGroups.map((g) => g.label === group.label ? {
                                        ...g, items: list
                                    } : g));
                                }
                            });
                    }
                });
                setGroups(Object.values(searchGroups));
            });
    }, [queryString]);

    function saveFilter(filter: string) {
        localStorage.setItem('searchView', filter);
        setFilter(filter);
    }

    return (
        <>
            {total > 0 && (
                <>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                        <span className={classes.resultsTitle}>
                            Showing results for
                        </span>
                        <span className={classes.resultsTitleItalic}>
                            {queryString}
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-3 flex-wrap"
                         style={{marginTop: isMobile ? '20px' : '30px'}}>
                        <span style={{lineHeight: '36px'}} className={classes.headerLabels}>
                            View as
                        </span>
                        <button
                            className={`${filter == 'list' ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}
                            onClick={() => {
                                saveFilter('list')
                            }}>
                            <ListIcon/>List
                        </button>
                        <button
                            className={`${filter == 'tiles' ? classes.activeFilter : classes.disabledFilter} ${classes.alaFilter}`}
                            onClick={() => saveFilter('tiles')}>
                            <TileIcon/>Tiles
                        </button>
                    </div>
                </>
            )}
            {queryString && total == 0 ? (
                <span style={{marginTop: '60px', display: 'block'}}>
                    No results found
                </span>
            ) : total == -1 && !queryString ? (
                <Examples tab="" setQueryAndTab={(query: string, tab: string | undefined) => {
                    setQuery(query);
                    setTab(tab || '');
                }}/>
            ) : null}
            {groups.map((group, index) => (
                <Fragment key={index}>
                    {group.count > 0 && (
                        <>
                            <div
                                className="d-flex justify-content-between"
                                onClick={() => setTab(group.tabName)}
                                style={{
                                    marginBottom: '30px',
                                    marginTop: isMobile ? '30px' : '60px',
                                }}
                            >
                                <span className={classes.groupName}>
                                    {group.label}
                                </span>
                                <a className={classes.groupCount}>
                                    See {group.count} results <ArrowRightIcon/>
                                </a>
                            </div>
                            {filter == 'list' && (
                                <>
                                    {group.items && group.items.map((item: any, index: number) => (
                                        <Fragment key={index}>
                                            {group.defn.renderListItemFn({item, navigate, wide: true, isMobile})}
                                            <hr style={{marginTop: '15px'}}/>
                                        </Fragment>
                                    ))}
                                </>
                            )}
                            {filter == 'tiles' && (
                                <div className="row">
                                    {group.items && group.items.map((item: any, index: number) => (
                                        <div className={isMobile ? 'col-12' : 'col-3'}
                                             key={index}
                                             style={{
                                                 paddingLeft: '20px',
                                                 paddingRight: '20px',
                                                 marginBottom: isMobile ? '15px' : '',
                                             }}>
                                            {group.defn.renderTileItemFn({item, navigate, wide: true, isMobile})}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Fragment>
            ))}
        </>
    );
}

export { searchGroupsTemplate };
export default AllView;
