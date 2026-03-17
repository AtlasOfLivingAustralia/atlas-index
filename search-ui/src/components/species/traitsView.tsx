/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FlaggedAlert, FontAwesomeIconLite, InfoBox} from '@ala/common-ui';
import {faCircleInfo, faDownload, faUpRightFromSquare} from '@fortawesome/free-solid-svg-icons';
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
        const ausTraitsLink = (
            <a className={classes.speciesLink} style={textStyle} target="_blank"
               href={import.meta.env.VITE_AUSTRAITS_HOME}>
                AusTraits
            </a>
        );
        const taxonName = <FormatName name={taxon} rankId={result?.rankID}/>;
        const doiLink = txt.match(/(doi.org[^ ]*)/g)?.map((doi, index) => (
            <a className={classes.speciesLink} style={textStyle} key={index} target="_blank" href={`https://${doi}`}>
                {doi}
            </a>
        ));

        return (
            <span style={textStyle}>
                {txt.split('AusTraits').map((part1, index1, array1) => (
                    <React.Fragment key={index1}>
                        {part1.split(taxon).map((part2, index2, array2) => (
                            <React.Fragment key={index2}>
                                {part2.split(/(doi.org[^ ]*)/g).map((part3, index3) => (
                                    <React.Fragment key={index3}>
                                        {part3.match(/doi.org/) ? doiLink : part3}
                                    </React.Fragment>
                                ))}
                                {index2 < array2.length - 1 && taxonName}
                            </React.Fragment>
                        ))}
                        {index1 < array1.length - 1 && ausTraitsLink}
                    </React.Fragment>
                ))}
            </span>
        );
    }


    return <>
        <div className={`${classes.traitsSectionText} ${classes.layoutGrid} row`}
             style={{marginLeft: 0, marginRight: 0}}>
            <div className={isMobile ? "" : "col-4"}>
                <div className={isMobile ? "" : classes.traitsLeftColumnWidth}>
                    <InfoBox size={isMobile ? 14 : 16} className="mb-2" icon={faCircleInfo}
                             title="About traits"
                             content={<>
                                 <p>
                                     The trait data shown here are a
                                     selection from&nbsp;
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     , an open-source, harmonised database of
                                     Australian plant trait data, sourced
                                     from individual researchers, government
                                     entities (e.g. herbaria) or NGOs across
                                     Australia.
                                 </p>
                                 <p>
                                     Traits vary in scope from morphological
                                     attributes (e.g. leaf area, seed mass,
                                     plant height) to ecological attributes
                                     (e.g. fire response, flowering time,
                                     pollinators) and physiological measures
                                     of performance (e.g. photosynthetic gas
                                     exchange, water-use efficiency).
                                 </p>
                                 <p>
                                     These traits are a sampler of those
                                     available in{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     . The data presented here are summary
                                     statistics derived from all
                                     field-collected data on adult plants
                                     available from{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     . Since the data presented are derived
                                     from the wide variety of sources in{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     , both the numeric trait statistics
                                     (min, mean, max) and categorical trait
                                     summaries (frequency of each trait
                                     value) that have been merged together
                                     could include data collected using
                                     different methods. The values presented
                                     for this species may reflect a summary
                                     of data from one or many sources, one or
                                     many samples from one or many adult
                                     plants at one or many locations. They
                                     may therefore differ from those
                                     presented elsewhere on the ALA platform
                                     and users are encouraged to download a
                                     spreadsheet of the full{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>{' '}
                                     data for this species via the download
                                     CSV button to view the accompanying
                                     details about the data sources before
                                     further use.
                                 </p>
                                 <p>
                                     Source:{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        target="_blank" href={import.meta.env.VITE_AUSTRAITS_DOI}>
                                         Zenodo
                                     </a>
                                     <br/>
                                     Rights holder:{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     <br/>
                                     Provided by:{' '}
                                     <a className={classes.speciesLink} style={textStyle}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                 </p>
                             </>
                             }/>
                    <img
                        src={import.meta.env.VITE_APP_AUSTRAITS_LOGO}
                        alt="Austraits logo"
                        style={{
                            width: isMobile ? '50%' : '100%',
                            marginTop: isMobile ? '15px' : '60px',
                            marginBottom: isMobile ? '15px' : '60px'
                        }}
                    />
                    <div style={{borderRadius: '5px', backgroundColor: '#F2F2F2', padding: '20px'}}>
                        <span style={textStyle}>
                            How to cite AusTraits data
                        </span>
                        <span style={{...textStyle, marginTop: '10px'}}>
                            Falster, Gallagher et al (2021) AusTraits, a
                            curated plant trait database for the Australian
                            flora. Scientific Data 8: 254,{' '}
                            <a className={classes.speciesLink} style={textStyle}
                               href="https://doi.org/10.1038/s41597-021-01006-6" target="_blank">
                                https://doi.org/10.1038/s41597-021-01006-6
                            </a>{' '}
                            - followed by the ALA url and access date. For
                            more information about citing information on the
                            ALA, see -{' '}
                            <a className={classes.speciesLink} style={textStyle}
                               href={import.meta.env.VITE_CITE_URL} target="_blank">
                                Citing the ALA
                            </a>.
                        </span>
                    </div>
                </div>
            </div>
            <div className={isMobile ? "" : "col-8"}>
                {loadingCounts &&
                    <div className="placeholder-glow" style={{height: 80, width: '100%', borderRadius: '5px'}}>
                        <span className="placeholder col-12"
                              style={{height: '100%', display: 'block', borderRadius: '5px'}}></span>
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
                    <span style={textStyle}>
                        There is currently no data for the taxon name you searched for in the AusTraits database.
                        Search for another species name or access the entire database at{' '}
                        <a className={classes.speciesLink} style={textStyle} target="_blank"
                           href="https://doi.org/10.5281/zenodo.10156222">
                            doi.org/10.5281/zenodo.10156222
                        </a>
                    </span>
                )}
                {traitsText && <>
                    {isMobile && <div style={{height: '15px'}}/>}

                    {explanation(traitsText, traitsTaxon)}

                    {(traits?.categorical_traits?.length > 0 || traits?.numeric_traits?.length > 0) && <>
                        <div className="d-flex gap-3 flex-md-row" style={{marginTop: isMobile ? '15px' : '30px'}}>
                            <button className="btn ala-btn-secondary d-flex align-items-center gap-2"
                                    onClick={() => {
                                        window.open(import.meta.env.VITE_AUSTRAITS_DEFINITIONS, '_blank');
                                    }}>
                                <FontAwesomeIconLite icon={faUpRightFromSquare} size="20"/>
                                AusTraits definitions
                            </button>
                            <button className="btn ala-btn-secondary d-flex align-items-center gap-2"
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
                                        });
                                    }}>
                                <FontAwesomeIconLite icon={faDownload} size="20"/>
                                Download CSV
                            </button>
                        </div>
                    </>
                    }
                </>}

                {loadingSummary && <>
                    <div className="placeholder-glow">
                        <span className="placeholder col-12"
                              style={{height: 500, width: '100%', borderRadius: '5px', marginTop: '20px'}}></span>
                    </div>
                </>}
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
                    <span className={classes.speciesDescriptionTitle}
                          style={{marginTop: isMobile ? '15px' : '60px', marginBottom: isMobile ? '7px' : '30px'}}>
                        Categorical Traits
                    </span>
                    {hasMoreValues && <>
                        <span className="fst-italic"
                              style={{...textStyle, marginBottom: isMobile ? '7px' : '30px', display: 'block'}}>
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
                </>}
                {traits?.numeric_traits?.length > 0 && <>
                    <span className={classes.speciesDescriptionTitle}
                          style={{marginTop: isMobile ? '15px' : '60px', marginBottom: isMobile ? '7px' : '30px'}}>
                        Numerical Traits
                    </span>
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
                </>}
            </div>
            {isMobile && <div style={{height: '15px'}}/>}
        </div>
    </>;
}

export default TraitsView;
