/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {DownloadIcon, FlaggedAlert, FontAwesomeIconLite, InfoBox} from '@ala/common-ui';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import React, {useEffect, useState} from 'react';
import FormatName from '../nameUtils/formatName.tsx';
import classes from './species.module.css';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

interface ListTraitItem {
    key?: string;
    name: string;
    value: string;
}

interface ListTraitSection {
    dataResourceUid: string;
    title: string;
    reference: string;
    listUrl?: string;
    metadataId?: string;
    metadataUrl?: string;
    traits: ListTraitItem[];
}

interface FieldMetadata {
    Column_key?: string;
    Column_header?: string;
    Category?: string;
    Units?: string;
    Definition?: string;
    Field_codes?: string;
    Explanation_of_field_factor_codes?: string;
    Source_of_data?: string;
    Notes?: string;
    [key: string]: string | undefined;
}

function TraitsView({result, isMobile}: MapViewProps) {
    const [traitsText, setTraitsText] = useState<string>('');
    const [traitsTaxon, setTraitsTaxon] = useState<string>('');
    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState<Record<PropertyKey, string | number | any>>({});
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [errorMessageCounts, setErrorMessageCounts] = useState('');
    const [noAusTraitsData, setNoAusTraitsData] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [errorMessageSummary, setErrorMessageSummary] = useState('');

    const [listTraits, setListTraits] = useState<ListTraitSection[]>([]);
    const [listMetadata, setListMetadata] = useState<Record<string, Record<string, FieldMetadata>>>({});
    const [expandedTraitKeys, setExpandedTraitKeys] = useState<Record<string, boolean>>({});
    const [loadingLists, setLoadingLists] = useState(false);
    const [errorMessageLists, setErrorMessageLists] = useState('');
    const [noListTraitsData, setNoListTraitsData] = useState(false);

    const textStyle = {fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}

    function getTraitsPath(source: string, ext: string): string {
        if (!result) return ''; // should never trigger

        // doubly encoded; once for the file name, once for the CDN/server that translates URL encoding to file name
        const lsidEncoded = encodeURIComponent(encodeURIComponent(result.guid));
        const last2 = lsidEncoded.substring(lsidEncoded.length - 2);
        return import.meta.env.VITE_TAXON_TRAITS_URL + '/' + source + '/' + last2 + '/' + lsidEncoded + ext;
    }

    function sanitizeFilename(name: string): string {
        return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    }

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        setLoadingCounts(true);
        setErrorMessageCounts('');
        setNoAusTraitsData(false);
        setTraitsText('');
        setTraitsTaxon('');

        const countUrl = getTraitsPath('austraits', '_count.json');
        fetch(countUrl).then((response) => {
            if (!response.ok) {
                setNoAusTraitsData(true);
                return null;
            }
            return response.json();
        }).then((data) => {
            if (data && data.length > 0) {
                setTraitsTaxon(data[0].taxon);
                setTraitsText(data[0].explanation);
            } else if (data !== null) {
                setNoAusTraitsData(true);
            }
        }).catch((error) => {
            setErrorMessageCounts(
                'Traits counts - ' + error + ' - ' + countUrl
            );
        }).finally(() => {
            setLoadingCounts(false);
        });

        setLoadingSummary(true);
        setErrorMessageSummary('');
        setTraits({});
        setHasMoreValues(false);

        const summaryUrl = getTraitsPath('austraits', '_summary.json');
        fetch(summaryUrl).then((response) => {
            if (!response.ok) {
                return null;
            }
            return response.json();
        }).then((data) => {
            if (!data) return;
            let hasMore = false;
            if (data?.categorical_traits) {
                data.categorical_traits.forEach((item: Record<string, any>) => {
                    if (item.trait_values.endsWith('*')) {
                        hasMore = true;
                    }
                });
                setHasMoreValues(hasMore);
                setTraits(data);
            }
        }).catch((error) => {
            setErrorMessageSummary('Traits summary - ' + error + ' - ' + summaryUrl);
        }).finally(() => {
            setLoadingSummary(false);
        });

        setLoadingLists(true);
        setErrorMessageLists('');
        setNoListTraitsData(false);
        setListTraits([]);
        setListMetadata({});
        setExpandedTraitKeys({});

        const listsUrl = getTraitsPath('lists', '.json');
        fetch(listsUrl).then((response) => {
            if (!response.ok) {
                setNoListTraitsData(true);
                return null;
            }
            return response.json();
        }).then((data) => {
            if (Array.isArray(data) && data.length > 0) {
                setListTraits(data);
                const metadataIds = Array.from(new Set(
                    data.map((s: ListTraitSection) => s.metadataId).filter((id): id is string => Boolean(id))
                ));
                metadataIds.forEach((metadataId) => {
                    const metaUrl = import.meta.env.VITE_TAXON_TRAITS_URL + '/lists/metadata/' + encodeURIComponent(metadataId) + '.json';
                    fetch(metaUrl)
                        .then((res) => (res.ok ? res.json() : null))
                        .then((metaData) => {
                            if (metaData && typeof metaData === 'object') {
                                setListMetadata((prev) => ({...prev, [metadataId]: metaData}));
                            }
                        })
                        .catch(() => {
                            // Metadata is optional enhancement; ignore fetch failures
                        });
                });
            } else if (data !== null) {
                setNoListTraitsData(true);
            }
        }).catch((error) => {
            setErrorMessageLists('List traits - ' + error + ' - ' + listsUrl);
        }).finally(() => {
            setLoadingLists(false);
        });
    }, [result]);

    function explanation(txt: string, taxon: string) {
        const taxonName = <FormatName name={taxon} rankId={result?.rankID}/>;
        const doiLink = txt.match(/(doi.org[^ ]*)/g)?.map((doi, index) => (
            <a className={classes.speciesLink} key={index} target="_blank" href={`https://${doi}`}>
                {doi}
            </a>
        ));

        return (
            <span className={classes.traitsExplanation}>
                {txt.split(taxon).map((part, index, parts) => (
                    <React.Fragment key={index}>
                        {part.split(/(doi.org[^ ]*)/g).map((text, textIndex) => (
                            <React.Fragment key={textIndex}>
                                {text.match(/doi.org/) ? doiLink : text}
                            </React.Fragment>
                        ))}
                        {index < parts.length - 1 && taxonName}
                    </React.Fragment>
                ))}
            </span>
        );
    }

    function renderReferenceText(reference: string) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return reference.split(urlRegex).map((part, index) => {
            if (part.match(/^https?:\/\//)) {
                return (
                    <a key={index} className={classes.speciesLink} href={part} target="_blank" rel="noreferrer">
                        {part}
                    </a>
                );
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
        });
    }

    const hasAusTraits = Boolean(
        traitsText ||
        traits?.categorical_traits?.length > 0 ||
        traits?.numeric_traits?.length > 0
    );
    const hasListTraits = listTraits.length > 0;
    const isLoadingInitial = (loadingCounts || loadingLists) && !hasAusTraits && !hasListTraits;
    const showNoData =
        !loadingCounts &&
        !loadingSummary &&
        !loadingLists &&
        !hasAusTraits &&
        !hasListTraits &&
        noAusTraitsData &&
        noListTraitsData &&
        !errorMessageCounts &&
        !errorMessageSummary &&
        !errorMessageLists;

    return <>
        <div className={classes.traitsSectionText}>
            {isLoadingInitial &&
                <div className={`${classes.traitsColumns} ${classes.traitsSummary} placeholder-glow`}
                     role="status" aria-label="Loading trait explanation">
                    <div className={`${classes.traitsFlexibleColumn} ${classes.traitsExplanation} ${classes.traitsSkeletonLines}`}
                         aria-hidden="true">
                        <span className="placeholder col-12"/>
                        <span className="placeholder col-12"/>
                        <span className="placeholder col-8"/>
                    </div>
                    {!isMobile && <div className={classes.traitsFixedColumn} aria-hidden="true"/>}
                </div>
            }
            {errorMessageCounts && (
                <FlaggedAlert
                    content={<>
                        <b>Error loading trait data.</b>
                        <p>
                            Report this error by clicking on the{' '}
                            <b>Need Help?</b> button on the right
                            edge of the screen.
                        </p>
                        <code>{errorMessageCounts}</code>
                    </>}
                />
            )}
            {errorMessageSummary &&
                <FlaggedAlert
                    content={<>
                        <b>Error loading trait data.</b>
                        <p>
                            Report this error by clicking on the{' '}
                            <b>Need Help?</b> button on the right
                            edge of the screen.
                        </p>
                        <code>{errorMessageSummary}</code>
                    </>}
                />
            }
            {errorMessageLists &&
                <FlaggedAlert
                    content={<>
                        <b>Error loading trait data.</b>
                        <p>
                            Report this error by clicking on the{' '}
                            <b>Need Help?</b> button on the right
                            edge of the screen.
                        </p>
                        <code>{errorMessageLists}</code>
                    </>}
                />
            }
            {showNoData && (
                <div className={classes.traitsSummary} style={textStyle}>
                    There is currently no trait data available for{' '}
                    {result?.name ? <FormatName name={result.name} rankId={result?.rankID}/> : 'this taxon'}.
                </div>
            )}
            {hasAusTraits && <>
                <h1 className={classes.traitsTitle}>AusTraits</h1>
                <div className={classes.traitsColumns}>
                    <div className={isMobile ? "" : classes.traitsFlexibleColumn}>
                        <InfoBox size={isMobile ? 14 : 16} lineHeight={isMobile ? 20 : 24} icon={faCircleInfo}
                                 title="About AusTraits"
                                 content={<>
                                     <p style={{ margin: 0 }}>
                                         <a className={classes.speciesLink} style={textStyle}
                                            href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                             AusTraits
                                         </a>
                                         {' '}is an open-source, harmonised database of
                                         Australian plant trait data, sourced
                                         from individual researchers, government
                                         entities (e.g. herbaria) or NGOs across
                                         Australia. Traits vary in scope from
                                         morphological attributes (e.g. leaf area,
                                         seed mass, plant height) to ecological
                                         attributes (e.g. fire response, flowering
                                         time, pollinators) and physiological
                                         measures of performance (e.g. photosynthetic
                                         gas exchange, water-use efficiency).
                                     </p>
                                 </>
                                 }/>
                    </div>
                    <div className={isMobile ? "" : `${classes.traitsFixedColumn} d-flex align-items-start justify-content-end`}>
                        <img
                            src={import.meta.env.VITE_APP_AUSTRAITS_LOGO}
                            alt="Austraits logo"
                            className={classes.traitsLogo}
                        />
                    </div>
                </div>
                {traitsText && <>
                    <div className={`${classes.traitsColumns} ${classes.traitsSummary}`}>
                        <div className={isMobile ? "" : classes.traitsFlexibleColumn}>
                            {explanation(traitsText, traitsTaxon)}
                        </div>
                        {(traits?.categorical_traits?.length > 0 || traits?.numeric_traits?.length > 0) && (
                            <div className={isMobile ? "" : `${classes.traitsFixedColumn} d-flex align-items-start justify-content-end`}>
                                <button className={`btn ala-btn-primary ${classes.traitsDownloadButton}`}
                                        onClick={() => {
                                            const csvUrl = getTraitsPath('austraits', '_data.csv');
                                            const filename = sanitizeFilename(result?.name || 'traits') + '.csv';
                                            fetch(csvUrl).then((response) => {
                                                if (!response.ok) throw new Error('HTTP ' + response.status);
                                                return response.blob();
                                            }).then((blob) => {
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = filename;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                            }).catch(() => {
                                                alert('Download failed');
                                            });
                                        }}>
                                    Download full CSV
                                    <DownloadIcon size="14" className={classes.traitsDownloadIcon}/>
                                </button>
                            </div>
                        )}
                    </div>
                </>}

                {loadingSummary && (
                    <div className="placeholder-glow" role="status" aria-label="Loading trait tables">
                        <div className={classes.traitsSectionTitle} aria-hidden="true">
                            <span className="placeholder col-4"/>
                        </div>
                        <div className={classes.traitsSkeletonTable} aria-hidden="true">
                            {[0, 1, 2, 3].map(row => (
                                <div key={row}>
                                    <span className="placeholder col-4"/>
                                    <span className="placeholder col-5"/>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {traits?.categorical_traits?.length > 0 && <>
                    <h2 className={classes.traitsSectionTitle}>
                        Categorical Traits
                    </h2>
                    {hasMoreValues && <>
                        <span className={classes.traitsFootnote}>
                            * Data sources in AusTraits report
                            multiple values for this trait,
                            suggesting variation across the taxon's
                            range and life stages. Please download
                            the raw data with information about the
                            context of data collection to assess
                            whether they are relevant to your
                            project.
                        </span>
                    </>}
                    <div className="table-responsive" tabIndex={0} role="region" aria-label="Categorical traits">
                    <table className="table table-striped" style={textStyle}>
                        <thead>
                        <tr>
                            <th>Trait Name</th>
                            <th>Trait Value</th>
                        </tr>
                        </thead>
                        <tbody>
                        {traits?.categorical_traits.map((item: Record<string, any>, idx: number) =>
                            <tr key={idx}>
                                <td>
                                    <a className={classes.speciesLink} style={textStyle} href={item.definition}>
                                        {item.trait_name}
                                    </a>
                                </td>
                                <td>{item.trait_values}</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                    </div>
                </>}
                {traits?.numeric_traits?.length > 0 && <>
                    <h2 className={classes.traitsSectionTitle}>
                        Numerical Traits
                    </h2>
                    <div className="table-responsive" tabIndex={0} role="region" aria-label="Numerical traits">
                    <table className="table table-striped" style={textStyle}>
                        <thead>
                        <tr>
                            <th>Trait Name</th>
                            <th className="text-end">Min</th>
                            <th className="text-end">Mean</th>
                            <th className="text-end">Max</th>
                            <th className="text-end">Unit</th>
                        </tr>
                        </thead>
                        <tbody>
                        {traits?.numeric_traits.map((item: Record<string, any>, idx: number) =>
                            <tr key={idx}>
                                <td>
                                    <a className={classes.speciesLink} style={textStyle}
                                        href={item.definition}>
                                        {item.trait_name}
                                    </a>
                                </td>
                                <td className="text-end">
                                    {item.min}
                                </td>
                                <td className="text-end">
                                    {item.mean}
                                </td>
                                <td className="text-end">
                                    {item.max}
                                </td>
                                <td className="text-end">
                                    {item.unit}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                    </div>
                </>}
                <div className={classes.traitsCitation}>
                    <p className="fw-bold">
                        How to cite AusTraits data
                    </p>
                    <p>
                        Falster, Gallagher et al (2021) AusTraits, a
                        curated plant trait database for the Australian
                        flora. Scientific Data 8: 254,{' '}
                        <a className={classes.speciesLink}
                            href="https://doi.org/10.1038/s41597-021-01006-6" target="_blank">
                            https://doi.org/10.1038/s41597-021-01006-6
                        </a>{' '}
                        - followed by the ALA url and access date. For
                        more information about citing information on the
                        ALA, see -{' '}
                        <a className={classes.speciesLink}
                            href={import.meta.env.VITE_CITE_URL} target="_blank">
                            Citing the ALA
                        </a>.
                    </p>
                </div>
            </>}
            {hasListTraits && listTraits.map((section, sectionIdx) => {
                const metaMap = section.metadataId ? (listMetadata[section.metadataId] || {}) : {};
                const groupedTraits: { category: string; items: ListTraitItem[] }[] = [];
                const categoryIndex = new Map<string, number>();

                (section.traits || []).forEach((item) => {
                    const meta = item.key ? metaMap[item.key] : undefined;
                    const category = meta?.Category || '';
                    if (!categoryIndex.has(category)) {
                        categoryIndex.set(category, groupedTraits.length);
                        groupedTraits.push({ category, items: [] });
                    }
                    groupedTraits[categoryIndex.get(category)!].items.push(item);
                });

                const hasCategories = groupedTraits.some((g) => g.category !== '');

                return (
                <div key={section.dataResourceUid || sectionIdx}>
                    {(hasAusTraits || sectionIdx > 0) && (
                        <hr style={{
                            marginTop: isMobile ? '20px' : '40px',
                            marginBottom: isMobile ? '15px' : '40px'
                        }}/>
                    )}
                    <h1 className={classes.traitsTitle}>{section.title}</h1>
                    {groupedTraits.map((group, groupIdx) => (
                        <React.Fragment key={group.category || groupIdx}>
                            {hasCategories && group.category && (
                                <h2 className={classes.traitsSectionTitle}>{group.category}</h2>
                            )}
                            <div className="table-responsive" tabIndex={0} role="region" aria-label={group.category || section.title}>
                                <table className={`table table-striped ${classes.traitsListTable}`} style={textStyle}>
                                    <thead>
                                    <tr>
                                        <th>Trait Name</th>
                                        <th>Trait Value</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {group.items.map((item, idx) => {
                                        const traitKey = item.key || item.name;
                                        const meta = item.key ? metaMap[item.key] : undefined;
                                        const units = meta?.Units?.trim();
                                        const isMissingCode = /^(na|nav)$/i.test(item.value.trim());
                                        const hasDetails = Boolean(
                                            meta?.Definition ||
                                            meta?.Field_codes ||
                                            meta?.Explanation_of_field_factor_codes ||
                                            meta?.Source_of_data ||
                                            meta?.Notes
                                        );
                                        const rowKey = `${section.dataResourceUid || sectionIdx}:${traitKey}`;
                                        const isExpanded = Boolean(expandedTraitKeys[rowKey]);

                                        return (
                                            <React.Fragment key={traitKey || idx}>
                                                <tr data-trait-key={traitKey}>
                                                    <td>
                                                        <span>{item.name}</span>
                                                        {hasDetails && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-link btn-sm p-0 ms-2 align-baseline"
                                                                aria-expanded={isExpanded}
                                                                aria-label={`Details for ${item.name}`}
                                                                onClick={() => setExpandedTraitKeys((prev) => ({
                                                                    ...prev,
                                                                    [rowKey]: !prev[rowKey],
                                                                }))}
                                                            >
                                                                <FontAwesomeIconLite icon={faCircleInfo} />
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {item.value}
                                                        {units && !isMissingCode ? ` ${units}` : ''}
                                                    </td>
                                                </tr>
                                                {hasDetails && isExpanded && (
                                                    <tr className="table-light" data-trait-details={traitKey}>
                                                        <td colSpan={2} style={{ fontSize: isMobile ? '13px' : '14px' }}>
                                                            {meta?.Definition && <div><strong>Definition:</strong> {meta.Definition}</div>}
                                                            {meta?.Field_codes && <div><strong>Field codes:</strong> {meta.Field_codes}</div>}
                                                            {meta?.Explanation_of_field_factor_codes && (
                                                                <div><strong>Code explanation:</strong> {meta.Explanation_of_field_factor_codes}</div>
                                                            )}
                                                            {meta?.Source_of_data && <div><strong>Source:</strong> {meta.Source_of_data}</div>}
                                                            {meta?.Notes && <div><strong>Notes:</strong> {meta.Notes}</div>}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </React.Fragment>
                    ))}
                    <div className={classes.traitsCitation}>
                        <p className="fw-bold">
                            Reference
                        </p>
                        {section.reference && (
                            <p style={{ whiteSpace: 'pre-line' }}>{renderReferenceText(section.reference)}</p>
                        )}
                        <p>
                            {section.listUrl && (
                                <>
                                    Source:{' '}
                                    <a className={classes.speciesLink} href={section.listUrl} target="_blank" rel="noreferrer">
                                        {section.listUrl}
                                    </a>.{' '}
                                </>
                            )}
                            {section.metadataUrl && (
                                <>
                                    Field metadata:{' '}
                                    <a className={classes.speciesLink} href={section.metadataUrl} target="_blank" rel="noreferrer">
                                        {section.metadataUrl}
                                    </a>.{' '}
                                </>
                            )}
                            For more information about citing information on the ALA, see -{' '}
                            <a className={classes.speciesLink}
                                href={import.meta.env.VITE_CITE_URL} target="_blank">
                                Citing the ALA
                            </a>.
                        </p>
                    </div>
                </div>
                );
            })}
        </div>
    </>;
}

export default TraitsView;
