/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from 'react';
import {GenericViewProps} from '../api/sources/model.ts';
import {searchGroupsTemplate} from '../components/search/allView.tsx';
import capitalise from '../helpers/Capitalise.ts';

export interface FacetItem {
    fq: string;
    label: string;
    count: number;
    depth: number;
    selected?: boolean;
}

export interface Facet {
    name: string;
    items: FacetItem[];
    order: number;
    lessNumber?: number;
}

export const PAGE_SIZE = 12;
// The search service rejects deep paging beyond 10,000 records (same limit as GenericView).
export const MAX_PAGE = Math.floor(10000 / PAGE_SIZE);

const searchUrl = (params: string) => `${import.meta.env.VITE_APP_API_URL}/v2/search?${params}`;
const enc = encodeURIComponent;

/** Same facet parsing as GenericView, kept separate from its rendering. */
function parseFacets(data: any, defn: GenericViewProps): Facet[] {
    const list: Facet[] = [];
    for (const name of Object.keys(defn.facetDefinitions)) {
        const facet = data.facetResults?.find((f: any) => f.fieldName === name);
        if (!facet) continue;
        const definition = defn.facetDefinitions[name];
        if (definition.parseFacetFn) {
            definition.parseFacetFn(facet, list);
            continue;
        }
        const items: FacetItem[] = facet.fieldResult
            .map((result: any) => ({fq: `${name}:"${result.label}"`, label: capitalise(result.label), count: result.count, depth: 0}))
            .filter((item: FacetItem) => item.label && item.label.trim() !== '')
            .sort((a: FacetItem, b: FacetItem) => a.label.localeCompare(b.label));
        if (items.length > 0) {
            list.push({name: definition.label, items, order: definition.order, lessNumber: definition.lessNumber});
        }
    }
    return list;
}

/** One tab's results and facets. Facet structure is fixed per query so selections don't reshuffle the list. */
export function useTabSearch(query: string | null, defn: GenericViewProps, page: number, sort: string, fqs: string[]) {
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [results, setResults] = useState<any[]>([]);
    const [baseFacets, setBaseFacets] = useState<Facet[]>([]);
    const [latestFacets, setLatestFacets] = useState<Facet[]>([]);
    const [customFacets, setCustomFacets] = useState<Facet[]>([]);
    const baseKey = useRef('');

    useEffect(() => {
        if (!query) {
            setResults([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        const isNewQuery = baseKey.current !== `${query}|${defn.fq}`;
        const facetNames = [...Object.keys(defn.facetDefinitions), ...(defn.customFacets ?? [])].join(',');
        const url = searchUrl(`q=${enc(query)}&facets=${facetNames}${fqs.map(fq => `&fq=${enc(fq)}`).join('')}` +
            `&pageSize=${PAGE_SIZE}&fq=${enc(defn.fq)}&page=${page}${sort}`);
        setLoading(true);
        fetch(url, {signal: controller.signal})
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(data => {
                const parsed = parseFacets(data, defn);
                setTotal(data.totalRecords ?? 0);
                setResults(data.searchResults ?? []);
                setLatestFacets(parsed);
                if (isNewQuery) {
                    baseKey.current = `${query}|${defn.fq}`;
                    setBaseFacets(parsed);
                }
                defn.addCustomFacetsFn?.({
                    url,
                    getFacets: isNewQuery,
                    thisFacetFqs: fqs,
                    parentData: data,
                    setCustomFacetData: (custom: Facet[]) => {
                        if (!controller.signal.aborted) setCustomFacets(custom.filter(facet => facet?.items?.length));
                    },
                });
                setLoading(false);
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                console.error('Search failed', error);
                setResults([]);
                setTotal(0);
                setLoading(false);
            });
        return () => controller.abort();
    }, [query, defn, page, sort, fqs.join('\u0000')]);

    // Overlay the latest counts and selections on the stable facet structure.
    const counts = new Map(latestFacets.flatMap(facet => facet.items.map(item => [item.fq, item.count] as const)));
    const facets = [
        ...baseFacets.map(facet => ({
            ...facet,
            items: facet.items.map(item => ({...item, count: counts.get(item.fq) ?? 0, selected: fqs.includes(item.fq)})),
        })),
        ...customFacets,
    ].sort((a, b) => a.order - b.order);

    return {loading, total, results, facets};
}

export interface GroupSummary {
    key: string;
    label: string;
    count: number;
    items: any[];
}

/** "All" tab: per-group counts plus the first four results of each group (same requests as AllView). */
export function useGroupSummaries(query: string | null) {
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState<GroupSummary[]>([]);

    useEffect(() => {
        setGroups([]);
        if (!query) {
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        const lookup = Object.fromEntries(Object.entries(searchGroupsTemplate)
            .flatMap(([key, group]) => group.types.map(type => [type, key])));
        setLoading(true);
        fetch(searchUrl(`q=${enc(query)}&facets=idxtype&pageSize=0`), {signal: controller.signal})
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                const counts: Record<string, number> = {};
                for (const facet of data?.facetResults?.[0]?.fieldResult ?? []) {
                    const key = lookup[facet.label];
                    if (key) counts[key] = (counts[key] ?? 0) + facet.count;
                }
                const initial = Object.entries(searchGroupsTemplate)
                    .map(([key, group]) => ({key, label: group.label, count: counts[key] ?? 0, items: [] as any[]}))
                    .filter(group => group.count > 0);
                setGroups(initial);
                setLoading(false);
                for (const group of initial) {
                    fetch(searchUrl(`q=${enc(query)}&pageSize=4&fq=${enc(searchGroupsTemplate[group.key].fq)}`), {signal: controller.signal})
                        .then(response => response.ok ? response.json() : null)
                        .then(result => setGroups(previous => previous.map(g =>
                            g.key === group.key ? {...g, items: result?.searchResults ?? []} : g)))
                        .catch(() => undefined);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [query]);

    return {loading, groups};
}

export async function fetchSuggestions(text: string, signal: AbortSignal): Promise<string[]> {
    const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/v1/bie/search/auto?limit=10&q=${enc(text)}`, {signal});
    const data = await response.json();
    const seen = new Set<string>();
    return (data.autoCompleteList ?? [])
        .map((item: any) => item.matchedNames?.[0] as string | undefined)
        .filter((name: string | undefined): name is string => !!name && !seen.has(name.toLowerCase()) && !!seen.add(name.toLowerCase()));
}
