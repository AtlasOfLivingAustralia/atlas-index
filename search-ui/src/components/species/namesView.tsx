/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {InfoBox} from '@ala/common-ui';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import '../../css/nameFormatting.css';
import {useEffect, useState} from 'react';
import classes from './species.module.css';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

interface DisambiguationRow {
    guid: string;
    nameFormatted: string;
    name: string;
    rank: string;
    rk_kingdom: string;
    occurrenceCount: number;
    taxonomicStatus: string;
    matchType: 'accepted name' | 'synonym' | 'variant' | 'common name';
    matchedName: string;
}

function NamesView({result, isMobile}: MapViewProps) {
    const [commonNames, setCommonNames] = useState<any[]>([]);
    const [indigenousNames, setIndigenousNames] = useState<any[]>([]);
    const [disambiguation, setDisambiguation] = useState<DisambiguationRow[]>([]);
    const [disambigLoading, setDisambigLoading] = useState(false);

    useEffect(() => {
        if (result?.vernacularData) {
            setCommonNames(result.vernacularData.filter((item: any) => item.status !== 'traditionalKnowledge'));
            setIndigenousNames(result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge'));
        }
    }, [result]);

    useEffect(() => {
        if (!result?.guid) return;

        // Collect all unique names to search for as plain strings
        const namesToSearch = new Set<string>();

        // accepted name
        if (result.name) namesToSearch.add(result.name);

        // additionalNames_m_s contains synonyms/additional names indexed for the taxon
        if (result.additionalNames_m_s) {
            result.additionalNames_m_s.forEach((n: string) => namesToSearch.add(n));
        }

        // common names
        if (result.vernacularData) {
            result.vernacularData.forEach((v: any) => {
                if (v.name) namesToSearch.add(v.name);
            });
        }

        if (namesToSearch.size === 0) return;

        // Build OR query using exact_text (keyword, case-insensitive normalised)
        const q = [...namesToSearch].map(name => `exact_text:"${name.replace(/"/g, '\\"')}"`).join(' OR ');

        const fl = 'guid,nameFormatted,name,rank,rk_kingdom,occurrenceCount,taxonomicStatus,scientificName,commonName,additionalNames_m_s';
        const url = import.meta.env.VITE_APP_BIE_URL
            + '/v2/search?fq=idxtype:TAXON&fq=-acceptedConceptID:*&pageSize=50&fl=' + fl
            + '&q=' + encodeURIComponent(q) + '&fq=-guid:"' + encodeURIComponent(result.guid) + '"';

        setDisambigLoading(true);
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (!data?.searchResults) return;

                const rows: DisambiguationRow[] = data.searchResults.map((hit: any) => {
                    // Find the first name from our list that matches this hit
                    let hitNames = [hit.scientificName, hit.name];
                    if (hit.commonName) {
                       hitNames.push(...hit.commonName);
                    }
                    if (hit.additionalNames_m_s) {
                        hitNames.push(...hit.additionalNames_m_s);
                    }

                    // convert to lowercase for later use
                    hitNames = hitNames.map(name => name.toLowerCase());

                    const matchedName = [...namesToSearch].find(name =>
                        hitNames.includes(name.toLowerCase())
                    ) ?? '';

                    // TODO: matchType is not working as intended
                    // Determine match type based on which collection the matched name came from
                    let matchType: DisambiguationRow['matchType'] = 'accepted name';
                    if (matchedName) {
                        const isCommon = result.commonName?.includes((v: any) => v.name === matchedName);
                        const isAdditional = result.additionalNames_m_s?.includes(matchedName);
                        if (isCommon) matchType = 'common name';
                        else if (isAdditional) matchType = 'synonym';
                    }

                    return {
                        guid: hit.guid,
                        nameFormatted: hit.nameFormatted || hit.name,
                        name: hit.name,
                        rank: hit.rank || '',
                        rk_kingdom: hit.rk_kingdom || '',
                        occurrenceCount: hit.occurrenceCount || 0,
                        taxonomicStatus: hit.taxonomicStatus || '',
                        matchType,
                        matchedName,
                    };
                });

                // Sort by matchType order then name
                const typeOrder: Record<DisambiguationRow['matchType'], number> = {
                    'accepted name': 0, 'synonym': 1, 'variant': 2, 'common name': 3
                };
                rows.sort((a, b) =>
                    typeOrder[a.matchType] - typeOrder[b.matchType] ||
                    a.name.localeCompare(b.name)
                );

                setDisambiguation(rows);
            })
            .catch(e => console.error('Disambiguation fetch error', e))
            .finally(() => setDisambigLoading(false));
    }, [result]);

    return <>
        <div>
            <span className={classes.speciesDescriptionTitle}>
                Scientific names
            </span>
            <div style={{height: isMobile ? '15px' : '30px'}}/>

            <table className="table table-striped align-middle"
                   style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                <thead>
                <tr>
                    <th>Accepted name</th>
                    <th style={{width: '30%'}}>Source</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td>
                        <span dangerouslySetInnerHTML={{__html: result?.nameFormatted}}/>
                        {result?.nameAccordingTo && (<>
                            <div style={{height: '10px'}}/>
                            <span style={{fontStyle: 'italic'}}>According to:{' '}{result?.nameAccordingTo}</span>
                        </>)}
                        {result?.namePublishedIn && (<>
                            <div style={{height: '10px'}}/>
                            <span style={{fontStyle: 'italic'}}>Published in:{' '}{result?.namePublishedIn}</span>
                        </>)}
                    </td>
                    <td>
                        <a href={result?.source} style={{color: '#003A70', textDecoration: 'underline'}}>
                            {result?.datasetName}
                        </a>
                    </td>
                </tr>
                </tbody>
            </table>
            <div style={{height: isMobile ? '0px' : '30px'}}/>

            {result?.synonymData && <>
                <table className="table table-striped align-middle"
                       style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                    <thead>
                    <tr>
                        <th>Synonyms</th>
                        <th style={{width: '30%'}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.synonymData.sort((a: any, b: any) => a.nameFormatted.localeCompare(b.nameFormatted)).map((item: any, idx: any) =>
                        <tr key={idx}>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source}
                                       dangerouslySetInnerHTML={{__html: item.nameFormatted}}
                                       style={{textDecoration: 'underline', color: '#003A70'}}/>
                                ) : (
                                    <span dangerouslySetInnerHTML={{__html: item.nameFormatted}}/>
                                )}
                                {item.nameAccordingTo && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>According to:{' '}{item.nameAccordingTo}</span>
                                </>)}
                                {item.namePublishedIn && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>Published in:{' '}{item.namePublishedIn}</span>
                                </>)}
                            </td>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source} style={{textDecoration: 'underline', color: '#003A70'}}>
                                        {item?.datasetName || 'Link'}</a>
                                ) : (<span>{item?.datasetName}</span>)}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                <div style={{height: isMobile ? '0px' : '30px'}}/>
            </>}

            {result?.variantData && <>
                <table className="table table-striped align-middle"
                       style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                    <thead>
                    <tr>
                        <th>Variants</th>
                        <th style={{width: '30%'}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.variantData.sort((a: any, b: any) => a.nameFormatted.localeCompare(b.nameFormatted)).map((item: any, idx: any) =>
                        <tr key={idx}>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source}
                                       dangerouslySetInnerHTML={{__html: item.nameFormatted}}
                                       style={{textDecoration: 'underline', color: '#003A70'}}/>
                                ) : (
                                    <span dangerouslySetInnerHTML={{__html: item.nameFormatted}}/>
                                )}
                                {item.nameAccordingTo && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>According to:{' '}{item.nameAccordingTo}</span>
                                </>)}
                                {item.namePublishedIn && (<>
                                    <div style={{height: '10px'}}/>
                                    <span style={{fontStyle: 'italic'}}>
                                        Published in:{' '}{item.namePublishedIn}</span>
                                </>)}
                            </td>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source} style={{textDecoration: 'underline', color: '#003A70'}}>
                                        {item?.datasetName || 'Link'}</a>
                                ) : (<span>{item?.datasetName}</span>)}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                <div style={{height: isMobile ? '0px' : '30px'}}/>
            </>}

            {result?.identifierData && <>
                <table className="table table-striped align-middle"
                       style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                    <thead>
                    <tr>
                        <th>Identifiers</th>
                        <th style={{width: '30%'}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {/* Remove duplicates based on potentially displayed information and links */}
                    {result.identifierData.filter((item: any, index: number, self: any[]) =>
                            index === self.findIndex((t: any) =>
                                t.guid === item.guid &&
                                t.nameAccordingTo === item.nameAccordingTo &&
                                t.namePublishedIn === item.namePublishedIn &&
                                t.datasetName === item.datasetName
                            )
                    ).sort((a: any, b: any) => a.guid.localeCompare(b.guid)).map((item: any, idx: any) =>
                        <tr key={idx}>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source} style={{textDecoration: 'underline', color: '#003A70'}}>
                                        {item?.guid}
                                    </a>
                                ) : (
                                    <span style={{overflowWrap: 'anywhere', wordBreak: 'break-word'}}>{item.guid}</span>
                                )}
                                {item.nameAccordingTo && (<>
                                    <div style={{height: '10px'}}/>
                                    <span style={{fontStyle: 'italic'}}>According to:{' '}{item.nameAccordingTo}</span>
                                </>)}
                                {item.namePublishedIn && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>Published in:{' '}{item.namePublishedIn}</span>
                                </>)}
                            </td>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source} style={{
                                        textDecoration: 'underline',
                                        color: '#003A70'
                                    }}>{item?.datasetName || 'Link'}</a>
                                ) : (
                                    <span>{item?.datasetName}</span>
                                )}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                <div style={{height: isMobile ? '0px' : '30px'}}/>
            </>}

            {commonNames && commonNames.length > 0 && <>
                <hr/>
                <div style={{height: isMobile ? '15px' : '30px'}}/>
                <span className={classes.speciesDescriptionTitle}>
                    Common names
                </span>
                <div style={{height: isMobile ? '15px' : '30px'}}/>
                <table className="table table-striped align-middle"
                       style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                    <thead>
                    <tr>
                        <th>Common name</th>
                        <th style={{width: '30%'}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {/* Remove duplicates based on potentially displayed information and links */}
                    {commonNames.filter((item: any, index: number, self: any[]) =>
                            index === self.findIndex((t: any) =>
                                t.name === item.name &&
                                t.nameAccordingTo === item.nameAccordingTo &&
                                t.namePublishedIn === item.namePublishedIn &&
                                t.datasetName === item.datasetName
                            )
                    ).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((item: any, idx: any) => (
                        <tr key={idx}>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source}
                                       style={{textDecoration: 'underline', color: '#003A70'}}>{item?.name}</a>
                                ) : (
                                    <span>{item.name}</span>
                                )}
                                {item.nameAccordingTo && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>According to:{' '}{item.nameAccordingTo}</span>
                                </>)}
                                {item.namePublishedIn && (<>
                                    <div style={{height: '10px'}}/>
                                    <span
                                        style={{fontStyle: 'italic'}}>Published in:{' '}{item.namePublishedIn}</span>
                                </>)}
                            </td>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source} style={{
                                        textDecoration: 'underline', color: '#003A70'
                                    }}>{item?.datasetName || 'Link'}</a>
                                ) : (
                                    <span>{item?.datasetName}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <div style={{height: isMobile ? '0px' : '30px'}}/>
            </>}

            {indigenousNames && indigenousNames.length > 0 && <>
                <hr/>
                <div style={{height: isMobile ? '15px' : '30px'}}/>
                <span className={classes.speciesDescriptionTitle}>
                    Indigenous names
                </span>
                <div style={{height: isMobile ? '15px' : '30px'}}/>
                <InfoBox
                    size={isMobile ? 14 : 16}
                    className="mb-2"
                    icon={faCircleInfo}
                    title="About indigenous names"
                    content={<>
                        The links from the Indigenous name provide
                        more information about Indigenous Ecological
                        Knowledge (IEK) relating to the species. The
                        link from language group links to the
                        Australian Institute of Aboriginal and
                        Torres Strait Islander Studies (
                        <a href="https://aiatsis.gov.au" target="_blank"
                           style={{color: '#003A70', textDecoration: 'underline'}}>
                            AIATSIS
                        </a>) information about the language.
                    </>}
                />
                <div style={{height: isMobile ? '15px' : '30px'}}/>
                <table className="table table-striped align-middle"
                       style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th style={{width: '30%'}}>See language group</th>
                    </tr>
                    </thead>
                    <tbody>
                    {indigenousNames.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((item: any, idx: any) =>
                        <tr key={idx}>
                            <td>
                                {item?.source ? (
                                    <a href={item?.source}
                                       style={{color: '#003A70', textDecoration: 'underline'}}>{item?.name}</a>
                                ) : (
                                    <span>{item.name}</span>
                                )}
                                {item.nameAccordingTo && (<>
                                    <div style={{height: '10px'}}/>
                                    <span style={{fontStyle: 'italic'}}>According to:{' '}{item.nameAccordingTo}</span>
                                </>)}
                                {item.namePublishedIn && (<>
                                    <div style={{height: '10px'}}/>
                                    <span style={{fontStyle: 'italic'}}>Published in:{' '}{item.namePublishedIn}</span>
                                </>)}
                            </td>
                            <td>
                                {item?.languageURL ? (
                                    <a href={item?.languageURL} style={{color: '#003A70', textDecoration: 'underline'}}>
                                        {item?.languageName || item?.language}</a>
                                ) : (
                                    <span>{item?.languageName || item?.language}</span>
                                )}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </>}

            {/* Disambiguation section */}
            {(disambigLoading || disambiguation.length > 0) && <>
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
                    content="These taxa share at least one name with this taxon when comparing the full sets of accepted, synonym, and common names. If multiple shared names are found, only one is reported."
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
                            <th style={{width: '20%'}}>Shared name</th>
                            <th>Shared with</th>
                            <th style={{width: '15%'}}>Rank</th>
                            <th style={{width: '15%'}}>Kingdom</th>
                            <th style={{width: '12%', textAlign: 'right'}}>Occurrences</th>
                        </tr>
                        </thead>
                        <tbody>
                        {disambiguation.map((row, idx) => (
                            <tr key={idx}>
                                <td>
                                    {/*<span style={{textTransform: 'capitalize'}}>{row.matchType}</span>*/}
                                    {row.matchedName && (
                                        <div style={{color: '#666', fontStyle: 'italic'}}>
                                            {row.matchedName}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <a href={`/species/${row.guid}`}
                                       style={{color: '#003A70', textDecoration: 'underline'}}
                                       dangerouslySetInnerHTML={{__html: row.nameFormatted}}/>
                                    {row.taxonomicStatus && (
                                        <div style={{fontSize: '0.85em', color: '#666', fontStyle: 'italic'}}>
                                            {row.taxonomicStatus}
                                        </div>
                                    )}
                                </td>
                                <td style={{textTransform: 'capitalize'}}>{row.rank}</td>
                                <td>{row.rk_kingdom}</td>
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
            </>}
        </div>
    </>;
}

export default NamesView;
