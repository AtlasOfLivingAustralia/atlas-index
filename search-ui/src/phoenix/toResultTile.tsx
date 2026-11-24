/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {ResultTileProps, ResultType} from '@ala/ui';
import type {ReactElement} from 'react';
import type {NavigateFunction} from 'react-router-dom';
import {GenericViewProps} from '../api/sources/model.ts';
import {getImageThumbnailUrl} from '../components/search/util.tsx';

const resultTypes: Record<string, ResultType> = {
    TAXON: 'species',
    COMMON: 'species',
    DATARESOURCE: 'dataset',
    DATAPROVIDER: 'dataset',
    INSTITUTION: 'dataset',
    COLLECTION: 'dataset',
    SPECIESLIST: 'species-list',
    BIOCOLLECT: 'data-project',
    DIGIVOL: 'data-project',
    LAYER: 'environmental-layer',
    REGION: 'region',
    LOCALITY: 'region',
    WORDPRESS: 'general-content',
    KNOWLEDGEBASE: 'help-article',
};

const plainText = (html?: string) =>
    html ? new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '' : '';

const truncate = (text: string, max = 220) => text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

const noNavigate = (() => undefined) as unknown as NavigateFunction;

/**
 * Each existing *Defn owns its result URL inside its JSX renderer, so read the href back from it.
 * shortcut: couples to renderGeneric*ItemFn returning <a href>; extract a getUrl(item) per Defn when migrating for real.
 */
function hrefFor(item: any, defn: GenericViewProps): string {
    const element = defn.renderListItemFn({item, navigate: noNavigate, wide: false, isMobile: false}) as ReactElement<{href?: string}>;
    return element?.props?.href ?? '#';
}

function detailsFor(item: any): string[] {
    const records = (count?: number) => `${(count ?? 0).toLocaleString()} occurrence records`;
    switch (resultTypes[item.idxtype]) {
        case 'species':
            return [
                item.commonNameSingle,
                item.speciesGroup && [...item.speciesGroup].reverse().join(', '),
                records(item.occurrenceCount),
            ].filter(Boolean);
        case 'dataset':
            return item.occurrenceCount != null ? [records(item.occurrenceCount)] : [];
        case 'species-list':
            return item.itemCount ? [`${item.itemCount} taxa`] : [];
        case 'data-project':
            return item.numberOfRecords > 0 ? [`${item.numberOfRecords} records`] : [];
        case 'environmental-layer':
            return [item.source, item.keywords].filter(Boolean);
        case 'region':
            return [item.idxtype === 'LOCALITY' ? 'Locality' : 'Region / Area', item.fieldName].filter(Boolean);
        default:
            return [Array.isArray(item.classification1) ? item.classification1.join(', ') : item.classification1].filter(Boolean);
    }
}

function imageFor(item: any): string | undefined {
    if (!item.image) return undefined;
    return resultTypes[item.idxtype] === 'species' ? getImageThumbnailUrl(item.image.split(',')[0]) : item.image;
}

export function toResultTile(item: any, defn: GenericViewProps): ResultTileProps {
    const type = resultTypes[item.idxtype] ?? 'general-content';
    return {
        type,
        href: hrefFor(item, defn),
        // phoenix italicises species titles; common-name matches are not scientific names.
        title: item.idxtype === 'COMMON' ? <span className="fst-normal">{item.name}</span> : item.name,
        details: detailsFor(item),
        description: truncate(plainText(item.heroDescription || item.description)) || undefined,
        imageSrc: imageFor(item),
        imageAlt: '',
    };
}
