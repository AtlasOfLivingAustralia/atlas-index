/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Singular DQ category count fetch for use by multiple components.
 */

const countCache = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

export function getCachedCount(key: string): number | undefined {
    return countCache.get(key);
}

export function setCachedCount(key: string, value: number): void {
    countCache.set(key, value);
}

export function hasCachedCount(key: string): boolean {
    return countCache.has(key);
}

export function dqCountCacheKey(search: string, inverseFilter: string): string {
    return search + "&disableAllQualityFilters=true&fq=" + inverseFilter;
}

export interface DqCategory {
    label: string;
    inverseFilter?: string;
}

/**
 * Fetch excluded-record counts for a list of DQ categories from cache, or fetch sequentially
 *
 * @param biocacheUrl  Base URL of the biocache service (no trailing slash needed).
 * @param search       The current query string (including leading '?').
 * @param categories   Ordered list of categories to fetch counts for.
 * @param onCount      Called after each category resolves with its count.
 */
export function fetchDqCountsSequentially(
    biocacheUrl: string,
    search: string,
    categories: DqCategory[],
    onCount: (label: string, count: number) => void
): void {
    if (!categories || categories.length === 0) return;

    const [category, ...rest] = categories;

    if (!category.inverseFilter) {
        fetchDqCountsSequentially(biocacheUrl, search, rest, onCount);
        return;
    }

    const key = dqCountCacheKey(search, category.inverseFilter);

    if (hasCachedCount(key)) {
        onCount(category.label, getCachedCount(key) as number);
        fetchDqCountsSequentially(biocacheUrl, search, rest, onCount);
        return;
    }

    // Reuse an existing in-flight request for the same key
    const existing = inFlight.get(key);
    const request: Promise<number> = existing ?? fetch(biocacheUrl + "/occurrences/search" + key + "&pageSize=0")
        .then(r => r.json())
        .then(data => {
            setCachedCount(key, data.totalRecords);
            return data.totalRecords as number;
        })
        .catch(() => 0)
        .finally(() => inFlight.delete(key));

    if (!existing) {
        inFlight.set(key, request);
    }

    request
        .then(count => onCount(category.label, count))
        .finally(() => fetchDqCountsSequentially(biocacheUrl, search, rest, onCount));
}
