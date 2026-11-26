/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {Facet} from '../api/types';

interface FacetPanelProps {
    facets: Facet[];
    selected: Record<string, string[]>;
    onToggle: (facetName: string, value: string) => void;
}

/** Left-hand refine-by-facet panel for the public search view. */
export default function FacetPanel({facets, selected, onToggle}: FacetPanelProps) {
    if (facets.length === 0) return null;

    return (
        <div data-testid="facet-panel">
            {facets.map(facet => (
                <div key={facet.name} className="mb-3">
                    <h6>{facet.label}</h6>
                    <ul className="list-unstyled">
                        {facet.values.map(fv => {
                            const checked = !!selected[facet.name]?.includes(fv.value);
                            return (
                                <li key={fv.value}>
                                    <label className="d-flex align-items-center gap-2">
                                        <input type="checkbox" checked={checked} onChange={() => onToggle(facet.name, fv.value)}/>
                                        <span>{fv.label ?? fv.value}</span>
                                        <span className="text-muted ms-auto">({fv.count})</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
