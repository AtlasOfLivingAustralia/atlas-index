/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import {faImage} from "@fortawesome/free-regular-svg-icons";
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router-dom';
import {Occurrence, OccurrenceListResult } from '../../api/model.tsx';
import AlertModal from './alertModal.tsx';

interface RecordsViewProps {
    results: OccurrenceListResult;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    sort: string;
    setSort: (value: ((prevState: string) => string) | string) => void;
    dir: string;
    setDir: (value: ((prevState: string) => string) | string) => void;
    page: number;
    setPage: (page: number) => void;
    queryString?: string;
}

function RecordsView({ results, pageSize, setPageSize, sort, setSort, dir, setDir, page, setPage, queryString }: RecordsViewProps) {
    const navigate = useNavigate();
    const [showAlerts, setShowAlerts] = useState(false);

    const intl = useIntl();

    function formatDate(date: number) {
        let d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    function openOccurrence(id: string) {
        navigate('/occurrence/' + id, { state: { recordsViewProps: { pageSize, sort, dir, page, queryString } } });
    }

    function findRawScientificName(occurrence: Occurrence) : string {
        if (occurrence.raw_scientificName) {
            return occurrence.raw_scientificName;
        } else if (occurrence.species) {
            return occurrence.species;
        } else if (occurrence.genus) {
            return occurrence.genus;
        } else if (occurrence.family) {
            return occurrence.family;
        } else if (occurrence.order) {
            return occurrence.order;
        } else if (occurrence.phylum) {
            return occurrence.phylum;
        }  else if (occurrence.kingdom) {
            return occurrence.kingdom;
        } else {
            return intl.formatMessage({ id:"record.noNameSupplied", defaultMessage: "No name supplied"});
        }
    }

    return (
        <>
            <div id='searchControls' className='row align-items-center'>
                <div className='col-sm-4 col-md-4'>
                    <button className='btn btn-outline-dark btn-sm' title={intl.formatMessage({ id: 'list.alerts.navigator.title', defaultMessage: 'Get email alerts for this search' })} onClick={() => setShowAlerts(true)}>
                        <i className='bi bi-bell-fill me-1'></i>
                        <FormattedMessage id={'list.alerts.navigator'} defaultMessage={'Alerts'} />
                    </button>
                </div>

                <div id='sortWidgets' className='col-sm-8 col-md-8'>
                    <div className='d-flex'>
                        <span className='ms-auto'></span>
                        <span className='hidden-sm'>
                            <FormattedMessage id='list.sortwidgets.span01' defaultMessage='per' />
                        </span>
                        &nbsp;
                        <FormattedMessage id='list.sortwidgets.span02' defaultMessage='page' />:
                        <select
                            id='per-page'
                            name='per-page'
                            className='input-small me-2 ms-1'
                            value={pageSize}
                            onChange={e => {
                                setPageSize(parseInt(e.target.value) || 20);
                                setPage(1);
                            }}>
                            <option value='10'>10</option>
                            <option value='20'>20</option>
                            <option value='50'>50</option>
                            <option value='100'>100</option>
                        </select>
                        &nbsp;
                        <FormattedMessage id='list.sortwidgets.sort.label' defaultMessage='sort' />:
                        <select
                            id='sort'
                            name='sort'
                            className='input-small me-2 ms-1'
                            value={sort}
                            onChange={e => {
                                setSort(e.target.value || 'first_loaded_date');
                                setPage(1);
                            }}>
                            <option value='score'>
                                <FormattedMessage id='list.sortwidgets.sort.option01' defaultMessage='Best match' />
                            </option>
                            <option value='taxon_name'>
                                <FormattedMessage id='list.sortwidgets.sort.option02' defaultMessage='Taxon name' />
                            </option>
                            <option value='common_name'>
                                <FormattedMessage id='list.sortwidgets.sort.option03' defaultMessage='Common name' />
                            </option>
                            <option value='occurrence_date'>
                                <FormattedMessage id='list.sortwidgets.sort.option0402' defaultMessage='Record date' />
                            </option>
                            <option value='record_type'>
                                <FormattedMessage id='list.sortwidgets.sort.option05' defaultMessage='Record type' />
                            </option>
                            <option value='first_loaded_date'>
                                <FormattedMessage id='list.sortwidgets.sort.option06' defaultMessage='Date added' />
                            </option>
                            <option value='last_assertion_date'>
                                <FormattedMessage id='list.sortwidgets.sort.option07' defaultMessage='Last annotated' />
                            </option>
                        </select>
                        &nbsp;
                        <FormattedMessage id='list.sortwidgets.dir.label' defaultMessage='order' />:
                        <select
                            id='dir'
                            name='dir'
                            className='input-small ms-1'
                            value={dir}
                            onChange={e => {
                                setDir(e.target.value || 'desc');
                                setPage(1);
                            }}>
                            <option value='asc'>
                                <FormattedMessage id='list.sortwidgets.dir.option01' defaultMessage='Ascending' />
                            </option>
                            <option value='desc'>
                                <FormattedMessage id='list.sortwidgets.dir.option02' defaultMessage='Descending' />
                            </option>
                        </select>
                    </div>
                </div>
            </div>

            <div id='results' className='row mt-3'>
                <div className='col-sm-12 col-md-12'>
                    <div id='resultsContainer'>
                        {results.occurrences &&
                            results.occurrences.map((result: any, idx) => (
                                <div key={idx} id={result.uuid} onClick={() => openOccurrence(result.uuid)}>
                                    { import.meta.env.VITE_SKIN == 'AVH' ?
                                        <div className='rowA' style={{ fontSize: '14px'}}>
                                            <p className='row'>
                                                {result.scientificName && !findRawScientificName(result).startsWith(result.scientificName) ?
                                                    <span className='occurrenceNames col-8'>
                                                        {result.scientificName} | provided name: {findRawScientificName(result)}
                                                    </span>
                                                    :
                                                    <span className='occurrenceNames col-8'>
                                                        {findRawScientificName(result)}
                                                    </span>
                                                }

                                                {result.raw_catalogNumber &&
                                                    <span className='col-4 text-end'>
                                                        <b className='resultsLabel'>Catalogue number:&nbsp;</b>
                                                        {result.raw_catalogNumber}
                                                    </span>
                                                }
                                            </p>
                                        </div>
                                        :
                                        <p className='rowA'>
                                            {result.taxonRank && result.scientificName ? (
                                                <>
                                                    <span style={{ textTransform: 'capitalize' }}>
                                                        <FormattedMessage id={'rank.' + result.taxonRank} defaultMessage={result.taxonRank} />
                                                    </span>
                                                    :&nbsp;
                                                    <span className='occurrenceNames' style={{ fontStyle: result.taxonRank || result.taxonRank >= 6000 ? 'italic' : '' }}>
                                                        {result.scientificName}
                                                    </span>
                                                </>
                                            ) : result.raw_scientificName ? (
                                                <span className='occurrenceNames'>{result.raw_scientificName}</span>
                                            ) : null}
                                            {(result.vernacularName || result.raw_vernacularName) && (
                                                <>
                                                    &nbsp;|&nbsp;<span className='occurrenceNames'>{result.vernacularName || result.raw_vernacularName}</span>
                                                </>
                                            )}
                                            {result.eventDate && (
                                                <span className='resultValue ms-2'>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.eventdate.label' />:{' '}
                                                    </span>
                                                    {formatDate(result.eventDate)}
                                                </span>
                                            )}
                                            {!result.eventDate && result.year && (
                                                <span className='resultValue ms-2'>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.year.label' />:{' '}
                                                    </span>
                                                    {formatDate(result.year)}
                                                </span>
                                            )}

                                            {result.stateProvince && (
                                                <span className='resultValue ms-2'>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.state.label' defaultMessage={result.stateProvince} />:&nbsp;
                                                    </span>
                                                    <FormattedMessage id={result.stateProvince} />
                                                </span>
                                            )}
                                            {!result.stateProvince && result.country && (
                                                <span className='resultValue ms-2'>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.country.label' />:&nbsp;
                                                    </span>
                                                    <FormattedMessage id={result.country} defaultMessage={result.country} />
                                                </span>
                                            )}
                                        </p>
                                    }
                                    { import.meta.env.VITE_SKIN == 'AVH' ? <div className='rowB' style={{ fontSize: '14px'}}>
                                        <p className='row' style={{ marginBottom: '0px'}}>
                                            {result.stateProvince && (
                                                <span className='col-12' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>State:&nbsp;</span>
                                                    {result.stateProvince}
                                                </span>
                                            )}
                                        </p>
                                        <p className='row' style={{ marginBottom: '0px'}}>
                                            <span className='col-6' style={{ textTransform: 'none' }}>
                                                <span className='resultsLabel'>Collector:&nbsp;</span>
                                                {result.collector}  {result.recordNumber}
                                            </span>
                                            {result.eventDate &&
                                                <span className='col-5' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>Date:&nbsp;</span>
                                                    {result.eventDate && intl.formatDate(result.eventDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            }
                                            {!result.eventDate && result.year &&
                                                <span className='col-5' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>Year:&nbsp;</span>
                                                    {result.year}
                                                </span>
                                            }
                                            {result.image && (
                                                <div className="col-1 text-end" title={`Record has ${result.images?.length ?? 1} associated image${(result.images?.length ?? 1) > 1 ? 's' : ''}`}>
                                                    <FontAwesomeIconLite icon={faImage} style={{height: '16px', width: '18px'}}/>
                                                </div>
                                            )}
                                        </p>
                                        <p className='row' style={{ marginBottom: '0px'}}>
                                            {result.collectionName &&
                                                <span className='col-8' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>Herbarium:&nbsp;</span>
                                                    {result.collectionName}
                                                </span>
                                            }
                                            {result.dataResourceName && !result.collectionName &&
                                                <span className='col-8' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>Data Resource::&nbsp;</span>
                                                    {result.dataResourceName}
                                                </span>
                                            }
                                            <span className='resultsLabel col-4 text-end'>
                                                <Link to={`/occurrence/${result.uuid}`}>
                                                    <FormattedMessage id={'record.view.record'} defaultMessage={'View record'} />
                                                </Link>
                                            </span>
                                        </p></div>
                                        :
                                        <p className='rowB'>
                                            {result.institutionName && (
                                                <span className='resultValue me-2' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.institutionName.label' />:
                                                    </span>
                                                    {result.institutionName}
                                                </span>
                                            )}
                                            {result.collectionName && (
                                                <span className='resultValue me-2' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.collectionName.label' />:
                                                    </span>
                                                    {result.collectionName}
                                                </span>
                                            )}
                                            {!result.collectionName && result.dataResourceName && (
                                                <span className='resultValue me-2' style={{ textTransform: 'none' }}>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.dataResourceName.label' />:
                                                    </span>
                                                    {result.dataResourceName}
                                                </span>
                                            )}
                                            {result.basisOfRecord && (
                                                <span className='resultValue me-2'>
                                                    <span className='resultsLabel'>
                                                        <FormattedMessage id='record.basisofrecord.label' />:
                                                    </span>
                                                    <FormattedMessage id={'basisOfRecord.' + result.basisOfRecord} />
                                                </span>
                                            )}
                                            {result.raw_catalogNumber && (
                                                <span className='resultValue me-2'>
                                                    <span className='resultsLabel' style={{ textTransform: 'none' }}>
                                                        <FormattedMessage id='record.catalogNumber.label' />
                                                    </span>
                                                    {(result.raw_collectionCode ? result.raw_collectionCode + ':' : '') + result.raw_catalogNumber}
                                                </span>
                                            )}

                                            <span className='resultsLabel'>
                                                <Link to={`/occurrence/${result.uuid}`}>
                                                    <FormattedMessage id={'record.view.record'} defaultMessage={'View record'} />
                                                </Link>
                                            </span>
                                        </p>
                                    }
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <div className='row mt-3'>
                <div className='col-12'>
                    <div className='d-flex justify-content-center'>
                        {page > 1 && (
                            <button className='btn btn-outline-dark btn-sm ms-1' onClick={() => setPage(page - 1)}>
                                <i className='bi bi-chevron-double-left' style={{ fontSize: '11px' }}></i> <FormattedMessage id={'show.previousbtn.navigator'} defaultMessage={'Previous'} />
                            </button>
                        )}

                        <button className='btn btn-outline-dark btn-sm ms-1' onClick={() => setPage(1)} disabled={page == 1}>
                            1
                        </button>

                        {Array.from(Array(9).keys()).map(idx => {
                            // rendering from page-4 to page +4
                            let lowerBound = Math.max(2, page - 4);
                            let maxPages = Math.ceil((results?.totalRecords || 1) / pageSize);
                            let p = lowerBound + idx;
                            if (p <= 20 && p <= maxPages) {
                                return (
                                    <div key={idx}>
                                        {lowerBound > 2 && idx == 0 && <button className='btn btn-outline-dark btn-sm ms-1'>..</button>}
                                        <button key={idx} className='btn btn-outline-dark btn-sm ms-1' disabled={page == p} onClick={() => setPage(p)}>
                                            {p}
                                        </button>
                                    </div>
                                );
                            } else {
                                return <div key={idx}></div>;
                            }
                        })}

                        {page * pageSize < (results.totalRecords || 1) && Math.min(20, page + 4) < Math.ceil((results.totalRecords || 1) / pageSize) && <button className='btn btn-outline-dark btn-sm ms-1'>..</button>}

                        {page * pageSize < (results.totalRecords || 1) && page < 20 && (
                            <button className='btn btn-outline-dark btn-sm ms-1' onClick={() => setPage(page + 1)}>
                                <FormattedMessage id={'show.nextbtn.navigator'} defaultMessage={'Next'} /> <i className='bi bi-chevron-double-right' style={{ fontSize: '11px' }}></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showAlerts && <AlertModal onClose={() => setShowAlerts(false)} results={results} queryString={queryString} />}
        </>
    );
}

export default RecordsView;

{
    /*<AlertModal />*/
}
