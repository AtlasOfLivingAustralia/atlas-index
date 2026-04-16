/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReactElement, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Breadcrumb } from '@ala/common-ui';
import { useQueryState } from 'nuqs';

interface FieldInfo {
    name: string;
    jsonName?: string;
    downloadName?: string;
    description?: string;
    downloadDescription?: string;
    dataType?: string;
    indexed?: boolean;
    stored?: boolean;
    multiValued?: boolean;
    i18nValues?: boolean;
    info?: string;
    infoUrl?: string;
    dwcTerm?: string;
    classs?: string;
    category?: string;
}

type SortKey = 'name' | 'downloadName' | 'dwcTerm' | 'classs' | 'dataType';
type SortOrder = 'ASC' | 'DESC';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const FILTER_PRESETS: { labelId: string; defaultLabel: string; value: string }[] = [
    { labelId: 'downloads.fields.filter.all',           defaultLabel: 'all fields',               value: '' },
    { labelId: 'downloads.fields.filter.dwc',           defaultLabel: 'only DwC terms',           value: 'dwcTerm:.*' },
    { labelId: 'downloads.fields.filter.environmental', defaultLabel: 'only environmental layers', value: 'name:el[0-9]*' },
    { labelId: 'downloads.fields.filter.contextual',    defaultLabel: 'only contextual layers',   value: 'name:cl[0-9]*' },
    { labelId: 'downloads.fields.filter.indexed',       defaultLabel: 'only indexed fields',      value: 'indexed:true' },
    { labelId: 'downloads.fields.filter.json',          defaultLabel: 'only JSON output fields',  value: 'jsonName:.*' },
];

function matchesFilter(field: FieldInfo, filter: string): boolean {
    if (!filter) return true;

    // Decode %7c to | so links from CustomDownload work whether URL-encoded or not
    const decoded = filter.replace(/%7c/gi, '|');

    // pipe-separated OR list — exact match against field.name
    if (decoded.includes('|')) {
        const parts = decoded.split('|').map(p => p.toLowerCase());
        return parts.includes((field.name || '').toLowerCase());
    }

    const colonIdx = decoded.indexOf(':');
    if (colonIdx > -1) {
        const key = decoded.substring(0, colonIdx) as keyof FieldInfo;
        let pattern = decoded.substring(colonIdx + 1);
        if (!pattern.startsWith('^')) pattern = '^' + pattern;
        const fieldValue = field[key];
        if (key === 'indexed') {
            return pattern === '^true' ? field.indexed === true : field.indexed !== true;
        }
        if (typeof fieldValue === 'string') {
            try {
                return new RegExp(pattern, 'i').test(fieldValue);
            } catch {
                return fieldValue.toLowerCase().includes(pattern.toLowerCase());
            }
        }
        return false;
    }

    // plain text search across all text fields
    const lower = decoded.toLowerCase();
    return (
        (field.name || '').toLowerCase().includes(lower) ||
        (field.jsonName || '').toLowerCase().includes(lower) ||
        (field.downloadName || '').toLowerCase().includes(lower) ||
        (field.dwcTerm || '').toLowerCase().includes(lower) ||
        (field.classs || '').toLowerCase().includes(lower) ||
        (field.description || '').toLowerCase().includes(lower) ||
        (field.downloadDescription || '').toLowerCase().includes(lower) ||
        (field.dataType || '').toLowerCase().includes(lower)
    );
}

function compareFields(a: FieldInfo, b: FieldInfo, sortKey: SortKey, order: SortOrder): number {
    const aVal = (a[sortKey] || '') as string;
    const bVal = (b[sortKey] || '') as string;

    // Empty values should always be last
    const aEmpty = aVal.trim() === '';
    const bEmpty = bVal.trim() === '';

    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    // If both are empty or both are non-empty, use localeCompare
    const cmp = aVal.localeCompare(bVal);
    return order === 'ASC' ? cmp : -cmp;
}

function Fields({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const intl = useIntl();

    const [allFields, setAllFields] = useState<FieldInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [appliedFilter, setAppliedFilter] = useQueryState('filter', { defaultValue: '' });
    const [filterInput, setFilterInput] = useState(appliedFilter);

    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Occurrence records', href: '/' },
            { title: 'Indexed fields', href: '/fields' },
        ]);

        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/index/fields`, { method: 'GET' })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: FieldInfo[]) => {
                setAllFields(data);
            })
            .catch(err => {
                console.error('Error fetching fields:', err);
                setError(err.message || 'Failed to load fields');
            })
            .finally(() => setLoading(false));
    }, []);

    const filteredAndSorted = useMemo(() => {
        return [...allFields]
            .filter(f => matchesFilter(f, appliedFilter))
            .sort((a, b) => compareFields(a, b, sortKey, sortOrder));
    }, [allFields, appliedFilter, sortKey, sortOrder]);

    const total = filteredAndSorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pageFields = filteredAndSorted.slice(startIdx, startIdx + pageSize);
    const start = total === 0 ? 0 : startIdx + 1;
    const end = Math.min(startIdx + pageSize, total);

    // Keep the text box in sync when the URL param changes (e.g. on first load or back/forward)
    useEffect(() => {
        setFilterInput(appliedFilter);
        setPage(1);
    }, [appliedFilter]);

    function applyFilter(value: string) {
        setAppliedFilter(value);
        setFilterInput(value);
        setPage(1);
    }

    function handleSearchSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAppliedFilter(filterInput);
        setPage(1);
    }

    function handlePageSizeChange(value: number) {
        setPageSize(value);
        setPage(1);
    }

    function handleSortChange(value: SortKey) {
        setSortKey(value);
        setPage(1);
    }

    function handleOrderChange(value: SortOrder) {
        setSortOrder(value);
        setPage(1);
    }

    function renderPageNumbers() {
        const pages: ReactElement[] = [];
        const window = 2;
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= safePage - window && i <= safePage + window)
            ) {
                pages.push(
                    <li key={i} className={`page-item${i === safePage ? ' active' : ''}`}>
                        <button className="page-link" onClick={() => setPage(i)}>
                            {i}
                        </button>
                    </li>
                );
            } else if (
                i === safePage - window - 1 ||
                i === safePage + window + 1
            ) {
                pages.push(
                    <li key={`ellipsis-${i}`} className="page-item disabled">
                        <span className="page-link">…</span>
                    </li>
                );
            }
        }
        return pages;
    }

    return (
        <div id='main' className='container-fluid'>
            <div className='container-fluid'>
                <div id='headingBar'>
                    <h1>
                        <FormattedMessage id='downloads.fields.heading' defaultMessage='Occurrence Record Fields' />
                    </h1>
                </div>

                <p
                    style={{ paddingBottom: '10px' }}
                    dangerouslySetInnerHTML={{
                        __html: (
                            (intl.messages['downloads.fields.intro'] as string) ??
                            'This table provides information on the occurrence record field types and mappings between search terms, JSON output terms, download headers, readable names, descriptions, Darwin Core (DwC) terms and classes, as well as other miscellaneous attributes.'
                        ).replace(/\{biocacheLink\}/g, `<a href="${import.meta.env.VITE_APP_BIOCACHE_URL}">${import.meta.env.VITE_APP_BIOCACHE_URL}</a>`)
                    }}></p>

                {/* Filter buttons */}
                <div className='row mb-2' id='filters'>
                    <div className='col-md-12'>
                        <span className='me-1'>
                            <FormattedMessage id='downloads.fields.filters' defaultMessage='Filters' />:
                        </span>
                        <div className='btn-group me-2'>
                            {FILTER_PRESETS.map(preset => (
                                <button key={preset.value} className={`btn btn-sm btn-outline-dark ${appliedFilter === preset.value ? ' active' : ''}`} onClick={() => applyFilter(preset.value)}>
                                    <FormattedMessage id={preset.labelId} defaultMessage={preset.defaultLabel} />
                                </button>
                            ))}
                        </div>
                        <form className='d-inline-block' onSubmit={handleSearchSubmit}>
                            <div className='input-group input-group-sm'>
                                <input className='form-control' type='text' value={filterInput} placeholder={intl.formatMessage({ id: 'downloads.fields.filter.search.placeholder', defaultMessage: 'Search fields...' })} onChange={e => setFilterInput(e.target.value)} />
                                <button className='btn btn-outline-dark' type='submit'>
                                    <FormattedMessage id='downloads.fields.filter.search.button' defaultMessage='Search' />
                                </button>
                                {appliedFilter && (
                                    <button className='btn btn-primary' type='button' title={intl.formatMessage({ id: 'downloads.fields.filter.clear', defaultMessage: 'clear' })} onClick={() => applyFilter('')}>
                                        &times;
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Pagination meta + sort controls */}
                {!loading && !error && (
                    <div className='row mb-2 align-items-center mt-4' id='table-metadata'>
                        <div className='col-md-5' id='pagination-details'>
                            {total === 0 ? (
                                <FormattedMessage id='downloads.fields.showing.results' defaultMessage='Showing 0–0 of 0 results' values={{ start: 0, end: 0, total: 0 }} />
                            ) : (
                                <FormattedMessage id='downloads.fields.showing.results' defaultMessage='Showing {start}–{end} of {total} results' values={{ start, end, total }} />
                            )}
                        </div>
                        <div className='col-md-7 d-flex align-items-center gap-2 flex-wrap' id='sort-widgets'>
                            <span>
                                <FormattedMessage id='downloads.fields.items.per.page' defaultMessage='Items per page' />:
                            </span>
                            <select className='form-select form-select-sm' style={{ width: 'auto' }} value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))}>
                                {PAGE_SIZE_OPTIONS.map(n => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                            <span>
                                <FormattedMessage id='downloads.fields.sort' defaultMessage='Sort' />:
                            </span>
                            <select className='form-select form-select-sm' style={{ width: 'auto' }} value={sortKey} onChange={e => handleSortChange(e.target.value as SortKey)}>
                                <option value='name'>{intl.formatMessage({ id: 'downloads.fields.search.name', defaultMessage: 'Search term' })}</option>
                                <option value='downloadName'>{intl.formatMessage({ id: 'downloads.fields.download.name', defaultMessage: 'Download term' })}</option>
                                <option value='dwcTerm'>{intl.formatMessage({ id: "downloads.fields.dwc.term", defaultMessage: 'DwC term' })}</option>
                                <option value='classs'>{intl.formatMessage({ id: "downloads.fields.dwc.class", defaultMessage: 'DwC class' })}</option>
                                <option value='dataType'>{intl.formatMessage({ id: 'downloads.fields.dwc.dataType', defaultMessage: 'Data type' })}</option>
                            </select>
                            <span>
                                <FormattedMessage id='downloads.fields.order' defaultMessage='Order' />:
                            </span>
                            <select className='form-select form-select-sm' style={{ width: 'auto' }} value={sortOrder} onChange={e => handleOrderChange(e.target.value as SortOrder)}>
                                <option value='ASC'>{intl.formatMessage({ id: 'downloads.fields.ascending', defaultMessage: 'Ascending' })}</option>
                                <option value='DESC'>{intl.formatMessage({ id: 'downloads.fields.descending', defaultMessage: 'Descending' })}</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Loading / error states */}
                {loading && (
                    <div className='text-center mt-4'>
                        <div className='spinner-border text-secondary' role='status'>
                            <span className='visually-hidden'>Loading…</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className='alert alert-danger mt-3' role='alert'>
                        {error}
                    </div>
                )}

                {/* Fields table */}
                {!loading && !error && (
                    <>
                        <div className='table-responsive'>
                            <table id='fieldsTable' className='table table-bordered table-striped'>
                                <thead>
                                    <tr>
                                        <th>
                                            <FormattedMessage id='downloads.fields.search.name' defaultMessage='Search name' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.jsonName.name' defaultMessage='Search results term' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.download.name' defaultMessage='Download name' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.dwc.term' defaultMessage='DwC term' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.dwc.class' defaultMessage='DwC class' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.description' defaultMessage='Description' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.download.descriptio' defaultMessage='Download description' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.furtherinformation' defaultMessage='Further information' />
                                        </th>
                                        <th>
                                            <FormattedMessage id='downloads.fields.attributes' defaultMessage='Attributes' />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageFields.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className='text-center text-muted'>
                                                No fields match your filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        pageFields.map(fld => (
                                            <tr key={fld.name}>
                                                <td>
                                                    <code>{fld.name}</code>
                                                </td>
                                                <td>{fld.jsonName}</td>
                                                <td>{fld.downloadName}</td>
                                                <td>
                                                    {fld.dwcTerm ? (
                                                        <a href={`https://rs.tdwg.org/dwc/terms/${fld.dwcTerm}`} target='_blank' rel='noopener noreferrer'>
                                                            {fld.dwcTerm}
                                                        </a>
                                                    ) : null}
                                                </td>
                                                <td>{fld.classs}</td>
                                                <td>{fld.description}</td>
                                                <td>{fld.downloadDescription}</td>
                                                <td>
                                                    {fld.info && <span>{fld.info} </span>}
                                                    {fld.infoUrl && (
                                                        <a href={fld.infoUrl} target='_blank' rel='noopener noreferrer'>
                                                            <FormattedMessage id='downloads.fields.wiki' defaultMessage='Wiki' />
                                                        </a>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className='d-flex flex-wrap gap-1'>
                                                        {fld.indexed && (
                                                            <span className='badge bg-info' title={intl.formatMessage({ id: 'downloads.fields.tooltip.indexed', defaultMessage: 'Indexed – this field is searchable' })}>
                                                                I
                                                            </span>
                                                        )}
                                                        {fld.stored && (
                                                            <span className='badge bg-success' title={intl.formatMessage({ id: 'downloads.fields.tooltip.stored', defaultMessage: 'Stored – this field is available in search results' })}>
                                                                S
                                                            </span>
                                                        )}
                                                        {fld.multiValued && (
                                                            <span className='badge bg-dark' title={intl.formatMessage({ id: 'downloads.fields.tooltip.multivalued', defaultMessage: 'Multi-valued – this field can contain multiple values' })}>
                                                                M
                                                            </span>
                                                        )}
                                                        {fld.i18nValues && (
                                                            <span className='badge bg-danger' title={intl.formatMessage({ id: 'downloads.fields.tooltip.i18nValues', defaultMessage: 'i18n – values are internationalised' })}>
                                                                i18n
                                                            </span>
                                                        )}
                                                        {fld.dataType && (
                                                            <span className='badge bg-secondary' title={intl.formatMessage({ id: 'downloads.fields.tooltip.datatype', defaultMessage: 'Data type' })}>
                                                                {fld.dataType}
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <nav aria-label='Fields pagination'>
                                <ul className='pagination'>
                                    <li className={`page-item${safePage === 1 ? ' disabled' : ''}`}>
                                        <button className='page-link' onClick={() => setPage(safePage - 1)}>
                                            &laquo;
                                        </button>
                                    </li>
                                    {renderPageNumbers()}
                                    <li className={`page-item${safePage === totalPages ? ' disabled' : ''}`}>
                                        <button className='page-link' onClick={() => setPage(safePage + 1)}>
                                            &raquo;
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Fields;



