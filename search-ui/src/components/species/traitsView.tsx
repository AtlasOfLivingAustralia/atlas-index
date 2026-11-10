/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {DownloadIcon, FlaggedAlert, InfoBox} from '@ala/common-ui';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import React, {useEffect, useState} from 'react';
import FormatName from '../nameUtils/formatName.tsx';
import classes from './species.module.css';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

function TraitsView({result, isMobile}: MapViewProps) {
    const [traitsText, setTraitsText] = useState<string>('');
    const [traitsTaxon, setTraitsTaxon] = useState<string>('');
    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState<Record<PropertyKey, string | number | any>>({});
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [errorMessageCounts, setErrorMessageCounts] = useState('');
    const [noTraitsData, setNoTraitsData] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [errorMessageSummary, setErrorMessageSummary] = useState('');

    const textStyle = {fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}

    function getTraitsPath(ext: string): string {
        if (!result) return ''; // should never trigger

        // doubly encoded; once for the file name, once for the CDN/server that translates URL encoding to file name
        const lsidEncoded = encodeURIComponent(encodeURIComponent(result.guid));
        const last2 = lsidEncoded.substring(lsidEncoded.length - 2);
        return import.meta.env.VITE_TAXON_TRAITS_URL + '/austraits/' + last2 + '/' + lsidEncoded + ext;
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
        setNoTraitsData(false);
        setTraitsText('');
        setTraitsTaxon('');

        const countUrl = getTraitsPath('_count.json');
        fetch(countUrl).then((response) => {
            if (!response.ok) {
                setNoTraitsData(true);
                return null;
            }
            return response.json();
        }).then((data) => {
            if (data && data.length > 0) {
                setTraitsTaxon(data[0].taxon);
                setTraitsText(data[0].explanation);
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

        const summaryUrl = getTraitsPath('_summary.json');
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


    return <>
        <h1 className={classes.traitsTitle}>AusTraits</h1>
        <div className={classes.traitsSectionText}>
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
            {loadingCounts &&
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
            {noTraitsData && !loadingCounts && (
                <div className={classes.traitsSummary} style={textStyle}>
                    There is currently no data for the taxon name you searched for in the AusTraits database.
                    Search for another species name or access the entire database at{' '}
                    <a className={classes.speciesLink} style={textStyle} target="_blank"
                        href="https://doi.org/10.5281/zenodo.10156222">
                        doi.org/10.5281/zenodo.10156222
                    </a>
                </div>
            )}
            {traitsText && <>
                <div className={`${classes.traitsColumns} ${classes.traitsSummary}`}>
                    <div className={isMobile ? "" : classes.traitsFlexibleColumn}>
                        {explanation(traitsText, traitsTaxon)}
                    </div>
                    {(traits?.categorical_traits?.length > 0 || traits?.numeric_traits?.length > 0) && (
                        <div className={isMobile ? "" : `${classes.traitsFixedColumn} d-flex align-items-start justify-content-end`}>
                            <button className={`btn ala-btn-primary ${classes.traitsDownloadButton}`}
                                    onClick={() => {
                                        const csvUrl = getTraitsPath('_data.csv');
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
        </div>
    </>;
}

export default TraitsView;
