/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {InfoBox} from '@ala/common-ui';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import {useEffect, useState} from 'react';
import classes from './species.module.css';

interface DisambiguationViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

interface DisambiguationRow {
    guid: string;
    nameFormatted: string;
    name: string;
    rank: string;
    rk_kingdom: string;
    rk_phylum: string;
    rk_class: string;
    rk_order: string;
    rk_family: string;
    rk_genus: string;
    rk_species: string;
    occurrenceCount: number;
    taxonomicStatus: string;
    matchTypeLabel: string;
    matchTypeSortKey: number;
    matchTypeSortSub: number;
    matchTypeDetailName: string;
    matchedNames: string[];
}

const RANK_ORDER = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'subspecies'];
const RANK_FIELDS = ['rk_kingdom', 'rk_phylum', 'rk_class', 'rk_order', 'rk_family', 'rk_genus', 'rk_species'];
const COUSIN_LABELS: Record<string, string> = {
    rk_genus: 'Same genus',
    rk_family: 'Same family',
    rk_order: 'Same order',
    rk_class: 'Same class',
    rk_phylum: 'Same phylum',
    rk_kingdom: 'Same kingdom',
};

function getRelationship(current: any, hit: any): { label: string; sortKey: number; sortSub: number; detailName: string } {
    const currentRankIdx = RANK_ORDER.indexOf((current.rank || '').toLowerCase());
    const hitRankIdx = RANK_ORDER.indexOf((hit.rank || '').toLowerCase());

    // Check if hit is an ancestor of current taxon
    if (hitRankIdx >= 0 && currentRankIdx > hitRankIdx) {
        const rkField = RANK_FIELDS[hitRankIdx];
        if (rkField && current[rkField] && hit.name &&
            current[rkField].toLowerCase() === hit.name.toLowerCase()) {
            return {label: 'Parent taxon', sortKey: 0, sortSub: hitRankIdx, detailName: ''};
        }
    }

    // Check if hit is a descendant of current taxon
    if (hitRankIdx >= 0 && currentRankIdx >= 0 && hitRankIdx > currentRankIdx) {
        const rkField = RANK_FIELDS[currentRankIdx];
        if (rkField && hit[rkField] && current.name &&
            hit[rkField].toLowerCase() === current.name.toLowerCase()) {
            return {label: 'Child taxon', sortKey: 1, sortSub: hitRankIdx, detailName: ''};
        }
    }

    // Find deepest shared classification level (cousin / convergent match)
    for (let i = RANK_FIELDS.length - 1; i >= 0; i--) {
        const field = RANK_FIELDS[i];
        if (current[field] && hit[field] &&
            current[field].toLowerCase() === hit[field].toLowerCase()) {
            const label = COUSIN_LABELS[field] || 'Related';
            return {label, sortKey: 2, sortSub: RANK_FIELDS.length - 1 - i, detailName: current[field]};
        }
    }

    return {label: 'Different kingdom', sortKey: 3, sortSub: 0, detailName: hit.rk_kingdom || ''};
}

function DisambiguationView({result, isMobile}: DisambiguationViewProps) {
    const [disambiguation, setDisambiguation] = useState<DisambiguationRow[]>([]);
    const [disambigLoading, setDisambigLoading] = useState(false);

    useEffect(() => {
        if (!result?.guid) return;

        // Collect all unique names to search for as plain strings
        const namesToSearch = new Set<string>();

        if (result.name) namesToSearch.add(result.name);

        if (result.additionalNames_m_s) {
            result.additionalNames_m_s.forEach((n: string) => namesToSearch.add(n));
        }

        if (result.vernacularData) {
            result.vernacularData.forEach((v: any) => {
                if (v.name) namesToSearch.add(v.name);
            });
        }

        if (namesToSearch.size === 0) return;

        const q = [...namesToSearch].map(name => `exact_text:"${name.replace(/"/g, '\\"')}"`).join(' OR ');

        const fl = 'guid,nameFormatted,name,rank,rk_kingdom,rk_phylum,rk_class,rk_order,rk_family,rk_genus,rk_species,occurrenceCount,taxonomicStatus,scientificName,commonName,additionalNames_m_s';
        const url = import.meta.env.VITE_APP_BIE_URL
            + '/v2/search?fq=idxtype:TAXON&fq=-acceptedConceptID:*&pageSize=50&fl=' + fl
            + '&q=' + encodeURIComponent(q) + '&fq=-guid:"' + encodeURIComponent(result.guid) + '"';

        setDisambigLoading(true);
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (!data?.searchResults) return;

                const rows: DisambiguationRow[] = data.searchResults.map((hit: any) => {
                    let hitNamesRaw: string[] = [hit.name, hit.scientificName];
                    if (hit.commonName) hitNamesRaw.push(...hit.commonName);
                    if (hit.additionalNames_m_s) hitNamesRaw.push(...hit.additionalNames_m_s);
                    const hitNamesLower = hitNamesRaw.filter(Boolean).map((n: string) => n.toLowerCase());

                    const matchedNames = [...namesToSearch].filter(name =>
                        hitNamesLower.includes(name.toLowerCase())
                    );

                    const rel = getRelationship(result, hit);

                    return {
                        guid: hit.guid,
                        nameFormatted: hit.nameFormatted || hit.name,
                        name: hit.name,
                        rank: hit.rank || '',
                        rk_kingdom: hit.rk_kingdom || '',
                        rk_phylum: hit.rk_phylum || '',
                        rk_class: hit.rk_class || '',
                        rk_order: hit.rk_order || '',
                        rk_family: hit.rk_family || '',
                        rk_genus: hit.rk_genus || '',
                        rk_species: hit.rk_species || '',
                        occurrenceCount: hit.occurrenceCount || 0,
                        taxonomicStatus: hit.taxonomicStatus || '',
                        matchTypeLabel: rel.label,
                        matchTypeSortKey: rel.sortKey,
                        matchTypeSortSub: rel.sortSub,
                        matchTypeDetailName: rel.detailName,
                        matchedNames,
                    };
                });

                rows.sort((a, b) =>
                    a.matchTypeSortKey - b.matchTypeSortKey ||
                    a.matchTypeSortSub - b.matchTypeSortSub ||
                    a.name.localeCompare(b.name)
                );

                setDisambiguation(rows);
            })
            .catch(e => console.error('Disambiguation fetch error', e))
            .finally(() => setDisambigLoading(false));
    }, [result]);

    if (!disambigLoading && disambiguation.length === 0) return null;

    return <>
        <div style={{height: isMobile ? '15px' : '30px'}}/>
        <hr/>
        <div style={{height: isMobile ? '15px' : '30px'}}/>
        <span className={classes.speciesDescriptionTitle}>
            Disambiguation
        </span>
        <div style={{height: isMobile ? '15px' : '30px'}}/>
        <InfoBox
            size={isMobile ? 14 : 16}
            className="mb-2"
            icon={faCircleInfo}
            title="About disambiguation"
            content="These taxa share at least one name with this taxon when comparing the full sets of accepted, synonym, and common names."
        />
        <div style={{height: isMobile ? '10px' : '20px'}}/>
        {disambigLoading
            ? <div className="d-flex justify-content-center py-3">
                <div className="spinner-border" role="status" style={{width: '1.5em', height: '1.5em'}}>
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
            : <table className="table table-striped align-middle"
                     style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                <thead>
                <tr>
                    <th style={{width: '30%'}}>Taxon</th>
                    <th style={{width: '18%'}}>Relationship</th>
                    <th>Names in common</th>
                    <th style={{width: '12%', textAlign: 'right'}}>Occurrences</th>
                </tr>
                </thead>
                <tbody>
                {disambiguation.map((row, idx) => (
                    <tr key={idx}>
                        <td>
                            <a href={`/species/${row.guid}`}
                               style={{color: 'var(--ala-link, #003A70)', textDecoration: 'underline'}}
                               dangerouslySetInnerHTML={{__html: row.nameFormatted}}/>
                            <div style={{
                                fontSize: '0.85em',
                                color: '#666',
                                fontStyle: 'italic',
                                textTransform: 'capitalize'
                            }}>
                                {row.rank}
                            </div>
                        </td>
                        <td>
                            {row.matchTypeLabel}
                            {row.matchTypeDetailName && <>
                                {': '}
                                <a href={`/species/${encodeURIComponent(row.matchTypeDetailName)}`}
                                   style={{color: 'var(--ala-link, #003A70)', textDecoration: 'underline'}}>
                                    {row.matchTypeDetailName}
                                </a>
                            </>}
                        </td>
                        <td>
                            {row.matchedNames.slice(0, 3).join(', ')}
                            {row.matchedNames.length > 3 && (
                                <span style={{color: '#666'}}>, …and {row.matchedNames.length - 3} more</span>
                            )}
                        </td>
                        <td style={{textAlign: 'right'}}>
                            {row.occurrenceCount > 0
                                ? <span>{row.occurrenceCount.toLocaleString()}</span>
                                : <span style={{color: '#666'}}>0</span>
                            }
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        }
        <div style={{height: isMobile ? '0px' : '30px'}}/>
    </>;
}

export default DisambiguationView;

