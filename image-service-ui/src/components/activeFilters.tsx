/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Badge} from 'react-bootstrap';
import type {SearchCriterion} from '../api/types';

interface ActiveFiltersProps {
    query?: string;
    facetFilters: Record<string, string[]>;
    criteria: SearchCriterion[];
    onRemoveQuery: () => void;
    onRemoveFacet: (facetName: string, value: string) => void;
    onRemoveCriterion: (id: string) => void;
    onClearAll: () => void;
}

/** Renders the current query / facet selections / advanced criteria as removable pills. */
export default function ActiveFilters({query, facetFilters, criteria, onRemoveQuery, onRemoveFacet, onRemoveCriterion, onClearAll}: ActiveFiltersProps) {
    const facetEntries = Object.entries(facetFilters).flatMap(([name, values]) => values.map(value => ({name, value})));
    const hasAny = !!query || facetEntries.length > 0 || criteria.length > 0;

    if (!hasAny) return null;

    return (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3" data-testid="active-filters">
            {query && (
                <Badge bg="secondary" className="d-flex align-items-center gap-1" data-testid="active-filter-query">
                    q: {query}
                    <button type="button" className="btn-close btn-close-white btn-sm" aria-label="Remove query" onClick={onRemoveQuery}/>
                </Badge>
            )}
            {facetEntries.map(({name, value}) => (
                <Badge key={`${name}:${value}`} bg="secondary" className="d-flex align-items-center gap-1">
                    {name}: {value}
                    <button type="button" className="btn-close btn-close-white btn-sm" aria-label={`Remove ${name} ${value}`} onClick={() => onRemoveFacet(name, value)}/>
                </Badge>
            ))}
            {criteria.map(c => (
                <Badge key={c.id} bg="info" text="dark" className="d-flex align-items-center gap-1">
                    {c.label} {c.operator} {c.value}
                    <button type="button" className="btn-close btn-sm" aria-label={`Remove ${c.label}`} onClick={() => onRemoveCriterion(c.id)}/>
                </Badge>
            ))}
            <button type="button" className="btn btn-link btn-sm" onClick={onClearAll}>Clear all</button>
        </div>
    );
}
