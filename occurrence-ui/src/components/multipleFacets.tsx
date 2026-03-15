/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import {faDownload} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/esm/Modal';
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';

interface MultipleFacetsProps {
    queryString: string | undefined;
    facet: string;
    onClose: () => void;
}

const resultsPageSize = 100;

function MultipleFacets({ queryString, facet, onClose }: MultipleFacetsProps) {
    const [facetItems, setFacetItems] = useState<any[] | null>(null);
    const [sortBy, setSortBy] = useState<string>('count'); // index or count
    const [sortDir, setSortDir] = useState<string>('asc'); // asc or desc (note that count treats asc as desc)
    const [maxResults, setMaxResults] = useState<number>(resultsPageSize);
    const [isExcludeOpen, setIsExcludeOpen] = useState<boolean>(false);
    const [isIncludeOpen, setIsIncludeOpen] = useState<boolean>(false);

    const intl: IntlShape = useIntl();
    const observerRef = useRef<HTMLAnchorElement | null>(null);

    useEffect(() => {
        fetchData();
    }, [queryString, facet]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && facetItems && facetItems.length >= maxResults) {
                    setMaxResults((prev) => prev + resultsPageSize);
                }
            },
            { threshold: 1.0 }
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observer.unobserve(observerRef.current);
            }
        };
    }, [observerRef.current]);


    function fetchData() {
        let url = import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/facets' + queryString + '&facets=' + encodeURIComponent(facet) + '&flimit=' + import.meta.env.VITE_FLIMIT_MAX + '&pageSize=0';

        fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                for (let item of data[0].fieldResult) {
                    item.labelFormatted = intl.formatMessage({ id: item.i18nCode, defaultMessage: item.label });
                }
                setFacetItems(data[0].fieldResult);
            });
    }

    function updateSortBy(newSortBy: string, currentSortBy: string, currentSortDir: string, setSortBy: (value: string) => void, setSortDir: (value: string) => void) {
        if (newSortBy === currentSortBy) {
            // Toggle sort direction if the same column is clicked
            setSortDir(currentSortDir === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new sort column and reset direction to ascending
            setSortBy(newSortBy);
            setSortDir('asc');
        }
        setMaxResults(resultsPageSize); // Reset max results on sort change
    }

    const toggleExcludeDropdown = () => {
        setIsExcludeOpen(!isExcludeOpen);
    };

    const toggleIncludeDropdown = () => {
        setIsIncludeOpen(!isIncludeOpen);
    };

    // adds params to the current query string and navigates to the new URL
    function addParams(newParams: string[]) {
        let url = new URL(window.location.href);
        let params = new URLSearchParams(url.search);

        // Add new parameters
        newParams.forEach(param => {
            let [key, value] = param.split('=');
            params.append(key, value);
        });

        // Navigate to the new URL
        window.location.href = url.pathname + '?' + params.toString();
    }

    function excludeSelected() {
        let selectedFqs: string[] = facetItems?.filter(item => item.checked).map(item => item.fq) || [];
        if (selectedFqs.length > 0) {
            let excludeFqs = selectedFqs.map(fq => '-' + fq);
            let newParams = excludeFqs.map(fq => 'fq=' + fq);
            addParams(newParams);
        }
    }

    function excludeAll() {
        let wildcardFq = '-' + facet + ':*';
        addParams(['fq=' + wildcardFq]);
    }

    function includeSelected() {
        let selectedFqs: string[] = facetItems?.filter(item => item.checked).map(item => item.fq) || [];
        if (selectedFqs.length > 0) {
            addParams([`fq=${selectedFqs.join(' OR ')}`]);
        }
    }

    function includeAll() {
        let wildcardFq = facet + ':*';
        addParams(['fq=' + wildcardFq]);
    }

    return (
        <>
            <Modal show={true} onHide={onClose} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FormattedMessage id='facets.multiplefacets.title' defaultMessage='Refine your search' />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div id='dynamic' className='tableContainer'>
                        <form name='facetRefineForm' id='facetRefineForm' method='GET' action='/occurrences/search/facets'>
                            {facetItems ? (
                                <table className='table table-bordered table-condensed table-striped scrollTable' id='fullFacets'>
                                    <thead className='fixedHeader'>
                                        <tr className='tableHead'>
                                            <th>&nbsp;</th>
                                            <th id='indexCol' style={{ width: '80%' }}>
                                                <a href="" onClick={(e) => {
                                                        e.preventDefault();
                                                        updateSortBy('index', sortBy, sortDir, setSortBy, setSortDir);
                                                   }}>
                                                    {intl.formatMessage({ id: 'facet.' + facet, defaultMessage: facet })}
                                                </a>
                                            </th>
                                            <th style={{ borderRightStyle: 'none', textAlign: 'right' }}>
                                                <a href="" onClick={(e) => {
                                                    e.preventDefault();
                                                    updateSortBy('count', sortBy, sortDir, setSortBy, setSortDir)
                                                }}>
                                                    <FormattedMessage id='facets.multiplefacets.tableth01' defaultMessage='Count' />
                                                </a>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className='scrollContent'>
                                        {facetItems.length > 0 &&
                                            facetItems.sort((a, b) => (sortBy === 'count' ? (sortDir === 'asc' ? b.count - a.count : a.count - b.count) : sortDir === 'asc' ? a.labelFormatted.localeCompare(b.labelFormatted) : b.labelFormatted.localeCompare(a.labelFormatted))).slice(0, maxResults).map((item, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <input type='checkbox' name='fqs' className='fqs'
                                                               checked={item.checked || false}
                                                               onChange={(e) => {
                                                                   item.checked = e.target.checked;
                                                                   setFacetItems([...facetItems]);
                                                               }}  />
                                                    </td>
                                                    <td>
                                                        <a href={queryString + '&fq=' + item.fq}>{item.labelFormatted}</a>
                                                    </td>
                                                    <td style={{ textAlign: 'right', borderRightStyle: 'none' }}>{intl.formatNumber(item.count)}</td>
                                                </tr>
                                            ))}
                                        {maxResults == import.meta.env.VITE_FLIMIT_MAX && <tr>
                                            <td colSpan={3} style={{ textAlign: 'center' }}>
                                                    <span ref={observerRef}>
                                                        <FormattedMessage id='facets.limitReached' defaultMessage='More items not shown' />
                                                    </span>
                                            </td>
                                        </tr>}
                                        {facetItems.length >= maxResults &&
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: 'center' }}>
                                                    <span ref={observerRef}>
                                                        <FormattedMessage id='facets.multiplefacets.tabletr01td01.showmore' defaultMessage='Show more results' />
                                                    </span>
                                                </td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            ) : (
                                <div>
                                    <span style={{ textAlign: 'center' }}>
                                        <FormattedMessage id='facets.multiplefacets.tabletr01td01' defaultMessage='loading data' />
                                        ... <div className='spinner-border' style={{height: "14px", width: "14px"}}/>
                                    </span>
                                </div>
                            )}
                        </form>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div className='btn-group' style={{ position: 'relative' }}>
                        <button className='submit btn btn-default btn-small' onClick={includeSelected}>
                            <FormattedMessage id='facets.includeSelected.button' defaultMessage='INCLUDE selected items' />
                        </button>
                        <button className='btn btn-default btn-small dropdown-toggle' onClick={toggleIncludeDropdown}>
                            <span className='caret'></span>
                        </button>
                        {isIncludeOpen && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0', zIndex: 1000, backgroundColor: '#fff', border: '1px solid #ccc', padding: '5px', listStyle: 'none', whiteSpace: 'nowrap' }}>
                                <li>
                                    <a onClick={includeAll}  style={{ cursor: 'pointer' }}>
                                        <FormattedMessage id='facets.submitfacets.li01' defaultMessage='INCLUDE all values (wildcard include)' />
                                    </a>
                                </li>
                            </ul>
                        )}
                    </div>
                    &nbsp;
                    <div className='btn-group' style={{ position: 'relative' }}>
                        <button className='submit btn btn-default btn-small' onClick={excludeSelected}>
                            <FormattedMessage id='facets.excludeSelected.button' defaultMessage='EXCLUDE selected items' />
                        </button>
                        <button className='btn btn-default btn-small dropdown-toggle' onClick={toggleExcludeDropdown}>
                            <span className='caret'></span>
                        </button>
                        {isExcludeOpen && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0', zIndex: 1000, backgroundColor: '#fff', border: '1px solid #ccc', padding: '5px', listStyle: 'none', whiteSpace: 'nowrap' }}>
                                <li>
                                    <a onClick={excludeAll} style={{ cursor: 'pointer' }}>
                                        <FormattedMessage id='facets.submitfacets.li02' defaultMessage='EXCLUDE all values (wildcard exclude)' />
                                    </a>
                                </li>
                            </ul>
                        )}
                    </div>
                    &nbsp;
                    <a href={import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/facets/download' + queryString + '&facets=' + encodeURIComponent(facet)}
                       target="_blank" className='btn btn-default btn-small' title={intl.formatMessage({id:'facets.downloadfacets.button', defaultMessage:'Download this list'})}>
                        <FontAwesomeIconLite icon={faDownload} title={intl.formatMessage({id:'facets.downloadfacets.button', defaultMessage:'Download this list'})}/>
                    </a>
                    <button className='btn btn-default btn-small' onClick={onClose} aria-hidden='true' style={{ float: 'right' }}>
                        <FormattedMessage id='facets.submitfacets.button' defaultMessage='Close' />
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default MultipleFacets;
