/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {RefineSection} from '@ala/common-ui';
import {JSX} from 'react';
import classes from './species.module.css';

export interface MapDistribution {
    geomIdx: string;
    dataResourceUid: string;
    areaName: string;
    dataResourceName: string;
    url?: string;
    checked?: boolean;
}

export interface CachedZoomOption {
    id: string;
    label: string;
}

interface MapRefineSectionProps {
    showOccurrences: boolean;
    onToggleOccurrences: () => void;
    distributions: MapDistribution[];
    onToggleDistribution: (idx: number) => void;
    collectionsUrl: string;
    noDistributionsLabel: JSX.Element | string;
    showCachedMap?: boolean;
    onToggleCachedMap?: (cached: boolean) => void;
}

/**
 * This controls both the leaflet map and cachedMapView.tsx, including a toggle to switch between them.
 */
function MapRefineSection({
    showOccurrences,
    onToggleOccurrences,
    distributions,
    onToggleDistribution,
    collectionsUrl,
    noDistributionsLabel,
    showCachedMap,
    onToggleCachedMap,
}: MapRefineSectionProps): JSX.Element {
    return (
        <div style={{paddingLeft: '5px'}}>
            <span className={classes.refineTitle} style={{display: 'block'}}>
                Refine map
            </span>

            <RefineSection
                title="Layers"
                items={[
                    {
                        label: 'Occurrence records',
                        onClick: onToggleOccurrences,
                        isOpen: showOccurrences,
                        isDisabled: () => false,
                    },
                    ...distributions.map((dist, idx) => ({
                        label: (
                            <>
                                {dist.areaName}
                                <span style={{display: 'block', fontStyle: 'italic', cursor: 'default'}}
                                      onClick={(e) => e.stopPropagation()}>
                                    provided by&nbsp;
                                    <a href={dist.dataResourceUid ? `${collectionsUrl}/public/show/${dist.dataResourceUid}` : '#'}
                                        style={{color: '#228be6', textDecoration: 'underline'}}>
                                        {dist.dataResourceName}
                                    </a>
                                </span>
                            </>
                        ),
                        onClick: () => onToggleDistribution(idx),
                        isOpen: dist.checked ?? false,
                        isDisabled: () => false,
                    })),
                ]}
            />
            {distributions.length === 0 && (
                <span style={{color: 'grey', display: 'block', marginTop: '15px'}}>
                    No expert distribution maps available for{' '}
                    {noDistributionsLabel}
                </span>
            )}

            {onToggleCachedMap !== undefined && (<>
                <span className={classes.refineSectionTitle}
                  style={{marginTop: '15px', marginBottom: '10px'}}>
                    Options
                </span>
                <div className="form-check">
                    <input
                        className={`form-check-input ${classes.mapRadio}`}
                        type="checkbox"
                        id="mapTypeInteractive"
                        checked={showCachedMap === false}
                        onChange={() => onToggleCachedMap(!showCachedMap)}
                    />
                    <label className={`form-check-label ${classes.refineItem}`} htmlFor="mapTypeInteractive">
                        Enable interactive map
                    </label>
                </div>
            </>)}
        </div>
    );
}

export default MapRefineSection;

