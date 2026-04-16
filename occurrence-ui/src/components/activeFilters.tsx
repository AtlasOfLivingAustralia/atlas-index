/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FormattedMessage, useIntl } from 'react-intl';

interface ActiveFiltersProps {
    queryString: string;
    onRemove: (fq: string) => void;
    onClearAll: () => void;
}

function ActiveFilters({ queryString, onRemove, onClearAll }: ActiveFiltersProps) {
    const intl = useIntl();

    if (!queryString) return null;

    const params = new URLSearchParams(queryString.startsWith('?') ? queryString.substring(1) : queryString);
    const fqs = params.getAll('fq');
    const wkt = params.get('wkt');
    const radius = params.get('radius');
    const lat = params.get('lat');
    const lon = params.get('lon');

    const hasSpatial = !!wkt || (!!radius && !!lat && !!lon);
    const totalCount = fqs.length + (hasSpatial ? 1 : 0);

    if (totalCount === 0) return null;

    function removeParam(fq: string) {
        onRemove(fq);
    }

    function removeSpatial() {
        if (wkt) {
            onRemove('wkt');
        } else {
            onRemove('radius');
        }
    }

    // Extract a human-readable label from an fq string e.g. "state:\"New South Wales\"" -> "New South Wales"
    function fqLabel(fq: string): string {
        // handle negation
        const negated = fq.startsWith('-');
        const raw = negated ? fq.substring(1) : fq;

        const colonIdx = raw.indexOf(':');
        if (colonIdx === -1) return fq;

        const field = raw.substring(0, colonIdx);
        let value = raw.substring(colonIdx + 1).replace(/^"(.*)"$/, '$1').replace(/^\[(.*)]$/, '$1');

        const i18nKey = `facet.${field}`;
        const fieldLabel = intl.formatMessage({ id: i18nKey, defaultMessage: field });

        return `${negated ? '-' : ''}${fieldLabel}: ${value}`;
    }

    return (
        <div className="activeFilters mb-2" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' , paddingTop: '1px', paddingBottom: '1px'}}>
            <b style={{marginLeft: '15px'}}><FormattedMessage id="search.filters.heading" defaultMessage="User selected filters"/>:</b>&nbsp;

            {fqs.map((fq, i) => (
                <span key={i} className="btn btn-outline-dark activeFilter" style={{ cursor: 'pointer' }}
                      title={intl.formatMessage({ id: 'list.resultsreturned.click.to.remove.filters', defaultMessage: 'Click to remove filter' })}
                      onClick={() => removeParam(fq)}>
                    {fqLabel(fq)}
                    <span className="ms-1">&times;</span>
                </span>
            ))}

            {wkt && (
                <span className="btn btn-outline-dark activeFilter"
                      title={intl.formatMessage({ id: 'list.resultsreturned.click.to.remove.filters', defaultMessage: 'Click to remove filter' })}
                      style={{ cursor: 'pointer' }} onClick={removeSpatial}>
                    <FormattedMessage id="list.resultsreturned.spatial.filter" defaultMessage="Spatial filter"/>: {wkt.match(/^\w+/)?.[0]}
                    <span className="ms-1">&times;</span>
                </span>
            )}

            {!wkt && radius && lat && lon && (
                <span className="btn btn-outline-dark activeFilter"
                      title={intl.formatMessage({ id: 'list.resultsreturned.click.to.remove.filters', defaultMessage: 'Click to remove filter' })}
                      style={{ cursor: 'pointer' }} onClick={removeSpatial}>
                    <FormattedMessage id="list.resultsreturned.spatial.filter" defaultMessage="Spatial filter"/>:&nbsp;
                    <FormattedMessage id="list.resultsreturned.circle" defaultMessage="Circle"/>
                    <span className="ms-1">&times;</span>
                </span>
            )}

            {totalCount > 1 && (
                <span
                    className="btn btn-primary activeFilter"
                    title={intl.formatMessage({ id: 'list.resultsreturned.button01.title', defaultMessage: 'Clear all filters' })}
                    onClick={onClearAll}
                    style={{ cursor: 'pointer' }}
                >
                    &gt;&nbsp;<FormattedMessage id="list.resultsreturned.button01" defaultMessage="Clear all"/>
                </span>
            )}
        </div>
    );
}

export default ActiveFilters;

