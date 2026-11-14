/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, Pagination, useUser} from '@ala/common-ui';
import {parseAsInteger, parseAsString, useQueryState} from 'nuqs';
import {useEffect, useMemo, useState} from 'react';
import {Form} from 'react-bootstrap';
import ActiveFilters from '../components/activeFilters.tsx';
import AdvancedCriteria from '../components/advancedCriteria.tsx';
import FacetPanel from '../components/facetPanel.tsx';
import ThumbnailGrid from '../components/thumbnailGrid.tsx';
import {searchApi} from '../api/endpoints.ts';
import {ApiError} from '../api/client.ts';
import type {Facet, SearchCriterion, SearchResult} from '../api/types.ts';
import {canEdit} from '../config/roles.ts';

const PAGE_SIZE = 30;
const DEEP_PAGING_MAX_PAGE = 500;

const SORT_OPTIONS: { value: string; label: string }[] = [
    {value: 'score', label: 'Relevance'},
    {value: 'dateUploaded', label: 'Date uploaded'},
    {value: 'title', label: 'Title'}
];

export default function Search({setBreadcrumbs, isMobile}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
    isMobile: boolean;
}) {
    const {userInfo} = useUser();
    const apiUrl = import.meta.env.VITE_APP_IMAGES_API_URL;

    const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
    const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(0));
    const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('score'));
    const [sortDirection, setSortDirection] = useQueryState('sortDirection', parseAsString.withDefault('desc'));
    const [facetState, setFacetState] = useQueryState('facets', parseAsString.withDefault(''));
    const [criteriaState, setCriteriaState] = useQueryState('criteria', parseAsString.withDefault(''));
    const facetFilters = useMemo<Record<string, string[]>>(() => {
        try { return facetState ? JSON.parse(facetState) : {}; } catch { return {}; }
    }, [facetState]);
    const criteria = useMemo<SearchCriterion[]>(() => {
        try { const value = criteriaState ? JSON.parse(criteriaState) : []; return Array.isArray(value) ? value : []; } catch { return []; }
    }, [criteriaState]);
    const [inputText, setInputText] = useState(query);

    const [result, setResult] = useState<SearchResult | null>(null);
    const [facets, setFacets] = useState<Facet[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'}
        ]);
    }, []);

    useEffect(() => {
        setInputText(query);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        const params = {
            q: query || undefined,
            page,
            pageSize: PAGE_SIZE,
            sort,
            sortDirection: sortDirection as 'asc' | 'desc',
            criteria,
            facetFilters,
            signal: controller.signal
        };
        Promise.all([searchApi.search(apiUrl, params), searchApi.facets(apiUrl, params)])
            .then(([searchResult, facetList]) => {
                setResult(searchResult);
                setFacets(facetList);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setResult(null);
                setFacets([]);
                setError(err?.message ?? 'Failed to load search results');
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [apiUrl, query, page, sort, sortDirection, criteria, facetFilters]);

    function submitSearch(e: React.FormEvent) {
        e.preventDefault();
        setQuery(inputText);
        setPage(0);
    }

    function toggleFacet(name: string, value: string) {
        const current = facetFilters[name] ?? [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        const updated = {...facetFilters, [name]: next};
        if (updated[name].length === 0) delete updated[name];
        setFacetState(Object.keys(updated).length ? JSON.stringify(updated) : null);
        setPage(0);
    }

    function addCriterion(criterion: SearchCriterion) {
        setCriteriaState(JSON.stringify([...criteria, criterion]));
        setPage(0);
    }

    function removeCriterion(id: string) {
        const next = criteria.filter(c => c.id !== id);
        setCriteriaState(next.length ? JSON.stringify(next) : null);
    }

    function clearAll() {
        setQuery('');
        setInputText('');
        setFacetState(null);
        setCriteriaState(null);
        setPage(0);
    }

    const canDownload = canEdit(userInfo) && !!result && result.totalRecords > 0;

    async function downloadResults() {
        setDownloading(true);
        setError(null);
        try {
            const {blob, filename} = await searchApi.download(apiUrl, {q: query || undefined, criteria, facetFilters});
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = filename || 'image-search-results.zip';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Failed to download search results');
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="container-fluid">
            <h1 className="mb-3">Image search</h1>

            <Form className="d-flex gap-2 mb-2" onSubmit={submitSearch}>
                <Form.Control
                    type="search"
                    placeholder="Search images by keyword, tag, filename or metadata"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    data-testid="search-input"
                />
                <Form.Select style={{maxWidth: 220}} value={sort} onChange={e => {
                    setSort(e.target.value);
                    setPage(0);
                }}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Form.Select>
                <Form.Select style={{maxWidth: 140}} value={sortDirection} onChange={e => {
                    setSortDirection(e.target.value);
                    setPage(0);
                }}>
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                </Form.Select>
                <button type="submit" className="btn btn-primary">Search</button>
            </Form>

            <AdvancedCriteria onAdd={addCriterion}/>

            <ActiveFilters
                query={query || undefined}
                facetFilters={facetFilters}
                criteria={criteria}
                onRemoveQuery={() => setQuery('')}
                onRemoveFacet={toggleFacet}
                onRemoveCriterion={removeCriterion}
                onClearAll={clearAll}
            />

            <div className="d-flex justify-content-between align-items-center mb-2">
                <div data-testid="result-count">
                    {result ? `${result.totalRecords.toLocaleString()} image${result.totalRecords === 1 ? '' : 's'} found` : ''}
                </div>
                {canDownload && (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={downloadResults} disabled={downloading} data-testid="download-zip">
                        {downloading ? 'Preparing ZIP…' : 'Download results as ZIP'}
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger" data-testid="search-error">{error}</div>}
            {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto" data-testid="search-loading"/></div>}

            {!loading && !error && (
                <div className="row">
                    <div className="col-md-3">
                        <FacetPanel facets={facets} selected={facetFilters} onToggle={toggleFacet}/>
                    </div>
                    <div className="col-md-9">
                        <ThumbnailGrid results={result?.results ?? []} apiUrl={apiUrl}/>
                        {result && result.totalRecords > PAGE_SIZE && (
                            <Pagination
                                page={page}
                                maxResults={result.totalRecords}
                                pageSize={PAGE_SIZE}
                                deepPagingMaxPage={DEEP_PAGING_MAX_PAGE}
                                onPageChange={setPage}
                                isMobile={isMobile}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
