/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from "react";
import classes from './species.module.css';
import FormatName from "../nameUtils/formatName.tsx";
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import {faUpRightFromSquare} from '@fortawesome/free-solid-svg-icons';
import {faDownload} from '@fortawesome/free-solid-svg-icons';
import FontAwesomeIcon from '../common-ui/fontAwesomeIconLite.tsx'
import InfoBox from "../common-ui/infoBox.tsx";
import FlaggedAlert from "../common-ui/flaggedAlert.tsx";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>
}

function TraitsView({result}: MapViewProps) {

    const [traitsText, setTraitsText] = useState<string>('');
    const [traitsTaxon, setTraitsTaxon] = useState<string>('');

    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState<Record<PropertyKey, string | number | any>>({});

    const [loadingCounts, setLoadingCounts] = useState(false);
    const [errorMessageCounts, setErrorMessageCounts] = useState('');

    const [loadingSummary, setLoadingSummary] = useState(false);
    const [errorMessageSummary, setErrorMessageSummary] = useState('');

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        setLoadingCounts(true);
        setErrorMessageCounts('');

        const countUrl = import.meta.env.VITE_APP_BIE_URL + "/trait-count" + getAusTraitsParam();
        fetch(countUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    setTraitsTaxon(data[0].taxon);
                    setTraitsText(data[0].explanation);
                }
            })
            .catch(error => {
                setErrorMessageCounts("Traits counts - " + error + " - " + countUrl);
            })
            .finally(() => {
                setLoadingCounts(false);
            });

        setLoadingSummary(true);
        setErrorMessageSummary('');

        const summaryUrl = import.meta.env.VITE_APP_BIE_URL + "/trait-summary" + getAusTraitsParam();
        fetch(summaryUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                var hasMore = false;
                if (data?.categorical_traits) {
                    data.categorical_traits.forEach((item: Record<string, any>) => {
                        if (item.trait_values.endsWith("*")) {
                            hasMore = true;
                        }
                    })
                    setHasMoreValues(hasMore)
                    setTraits(data)
                }
            })
            .catch(error => {
                setErrorMessageSummary("Traits summary - " + error + " - " + summaryUrl);
            })
            .finally(() => {
                setLoadingSummary(false);
            });
    }, [result]);

    function explanation(txt: string, taxon: string) {
        const ausTraitsLink = <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                 target="_blank"
                                 href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</a>;
        const taxonName = <FormatName name={taxon} rankId={result?.rankID}/>;
        const doiLink = txt.match(/(doi.org[^ ]*)/g)?.map((doi, index) => (
            <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}} key={index}
               target="_blank" href={`https://${doi}`}>{doi}</a>
        ));

        return (
            <span style={{fontSize: "16px", lineHeight: "24px"}}>
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

    function getAusTraitsParam() {
        if (result?.name) {
            return "?taxon=" + encodeURIComponent(result.name) + (result.guid.includes("apni") ? "&APNI_ID=" + encodeURIComponent(result.guid.split('/')[result.guid.split('/').length - 1]) : "")
        } else {
            return "";
        }
    }

    return <>
        <div className={`${classes.traitsSectionText} ${classes.layoutGrid} row`}
             style={{marginLeft: 0, marginRight: 0}}>
            <div className="col-4">
                <div className={classes.traitsLeftColumnWidth}>
                    <InfoBox className="mb-2" icon={faCircleInfo} title="About traits"
                             content={<>
                                 <p>The trait data shown here are a selection from&nbsp;
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>, an open-source, harmonised database of Australian plant trait data, sourced
                                     from
                                     individual researchers, government entities (e.g. herbaria) or NGOs across
                                     Australia.</p>
                                 <p>Traits vary in scope from morphological attributes (e.g. leaf area, seed mass, plant
                                     height) to ecological attributes (e.g. fire response, flowering time, pollinators)
                                     and physiological measures of performance (e.g. photosynthetic gas exchange,
                                     water-use efficiency).</p>
                                 <p>These traits are a sampler of those available in{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     . The data presented here are summary statistics derived from all field-collected
                                     data on adult plants available from{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     . Since the data presented are derived from the wide variety of sources in{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     , both the numeric trait statistics (min, mean, max) and categorical trait
                                     summaries (frequency of each trait value)
                                     that have been merged together could include data collected using different
                                     methods. The values presented for this
                                     species may reflect a summary of data from one or many sources, one or many samples
                                     from one or many adult plants at
                                     one or many locations. They may therefore differ from those presented elsewhere on
                                     the ALA platform and users are
                                     encouraged to download a spreadsheet of the full{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     {" "}data for this species via the download CSV button to view the accompanying
                                     details about the data sources before further use.
                                 </p>
                                 <p>
                                     Source:{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        target="_blank" href={import.meta.env.VITE_AUSTRAITS_DOI}>
                                         Zenodo
                                     </a>
                                     <br/>
                                     Rights holder:{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                     <br/>
                                     Provided by:{" "}
                                     <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                        href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                         AusTraits
                                     </a>
                                 </p>
                             </>
                             }
                    />
                    <img src={import.meta.env.VITE_APP_AUSTRAITS_LOGO} alt="Austraits logo"
                         style={{width: "100%", marginTop: "60px", marginBottom: "60px"}}/>
                    <div style={{borderRadius: "5px", backgroundColor: "#F2F2F2", padding: "20px"}}>
                        <span style={{fontSize: "16px", lineHeight: "24px"}}>How to cite AusTraits data</span>
                        <span style={{fontSize: "16px", lineHeight: "24px", marginTop: "10px"}}>
                        Falster, Gallagher et al (2021) AusTraits, a curated plant trait database for the Australian flora. Scientific Data 8: 254,{" "}
                            <a
                                className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                href="https://doi.org/10.1038/s41597-021-01006-6"
                                target="_blank"
                            >
                            https://doi.org/10.1038/s41597-021-01006-6
                        </a>{" "}
                            - followed by the ALA url and access date. For more information about citing information on the ALA, see -{" "}
                            <a
                                className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                href={import.meta.env.VITE_CITE_URL}
                                target="_blank"
                            >
                            Citing the ALA
                        </a>.
                    </span>
                    </div>
                </div>
            </div>
            <div className="col-8">
                {loadingCounts &&
                    <div className="placeholder-glow"
                         style={{height: 80, width: "100%", borderRadius: "5px"}}>
                        <span className="placeholder col-12"
                              style={{height: "100%", display: "block", borderRadius: "5px"}}></span>
                    </div>
                }
                {errorMessageCounts && <FlaggedAlert content={<><b>Error loading trait data.</b>
                    <p>Report this error by clicking on the <b>Need Help?</b> button on the
                        right edge of the screen.</p>
                    <code>{errorMessageCounts}</code></>}/>}
                {traitsText &&
                    <>
                        {explanation(traitsText, traitsTaxon)}

                        {(traits?.categorical_traits?.length > 0 || traits?.numeric_traits?.length > 0) && <>
                            <div className="d-flex gap-3 flex-column flex-md-row" style={{marginTop: "30px"}}>
                                <button
                                    className="btn ala-btn-secondary d-flex align-items-center gap-2"
                                    onClick={() => {
                                        window.open(import.meta.env.VITE_AUSTRAITS_DEFINITIONS, '_blank');
                                    }}
                                >
                                    <FontAwesomeIcon icon={faUpRightFromSquare} size="20"/>
                                    AusTraits definitions
                                </button>
                                <button
                                    className="btn ala-btn-secondary d-flex align-items-center gap-2"
                                    onClick={() => {
                                        window.open(import.meta.env.VITE_APP_BIE_URL + "/download-taxon-data" + getAusTraitsParam(), '_blank');
                                    }}
                                ><FontAwesomeIcon icon={faDownload} size="20"/>
                                    Download CSV
                                </button>
                            </div>
                        </>
                        }
                    </>
                }

                {loadingSummary &&
                    <>
                        <div className="placeholder-glow">
                            <span className="placeholder col-12"
                                  style={{height: 500, width: "100%", borderRadius: "5px", marginTop: "20px"}}></span>
                        </div>
                    </>
                }
                {errorMessageSummary && <FlaggedAlert content={<><b>Error loading trait data.</b>
                    <p>Report this error by clicking on the <b>Need Help?</b> button on the
                        right edge of the screen.</p>
                    <code>{errorMessageSummary}</code></>}/>}
                {traits?.categorical_traits?.length > 0 &&
                    <>
                        <span className={classes.speciesDescriptionTitle}
                              style={{marginTop: "60px", marginBottom: "30px"}}>Categorical Traits</span>
                        {hasMoreValues && <>
                            <span className="fst-italic" style={{
                                fontSize: "16px",
                                lineHeight: "24px",
                                marginBottom: "30px",
                                display: "block"
                            }}>* Data sources in AusTraits report multiple values for this
                                trait, suggesting variation across the taxon's range and life stages. Please download the raw
                                data with information about the context of data collection to assess whether they are
                                relevant to your project.</span>
                        </>
                        }
                        <table className="table table-striped" style={{fontSize: "16px", lineHeight: "24px"}}>
                            <thead>
                            <tr>
                                <th>Trait Name</th>
                                <th>Trait Value</th>
                            </tr>
                            </thead>
                            <tbody>
                            {traits?.categorical_traits.map((item: Record<string, any>, idx: number) => (
                                <tr key={idx}>
                                    <td>
                                        <a className={classes.speciesLink}
                                           style={{fontSize: "16px", lineHeight: "24px"}} href={item.definition}>
                                            {item.trait_name}
                                        </a>
                                    </td>
                                    <td>{item.trait_values}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </>
                }
                {traits?.numeric_traits?.length > 0 &&
                    <>
                        <span className={classes.speciesDescriptionTitle}
                              style={{marginTop: "60px", marginBottom: "30px"}}>Numerical Traits</span>
                        <table className="table table-striped" style={{fontSize: "16px", lineHeight: "24px"}}>
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
                            {traits?.numeric_traits.map((item: Record<string, any>, idx: number) => (
                                <tr key={idx}>
                                    <td>
                                        <a className={classes.speciesLink}
                                           style={{fontSize: "16px", lineHeight: "24px"}}
                                           href={item.definition}>
                                            {item.trait_name}
                                        </a>
                                    </td>
                                    <td className="text-end">{item.min}</td>
                                    <td className="text-end">{item.mean}</td>
                                    <td className="text-end">{item.max}</td>
                                    <td className="text-end">{item.unit}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </>
                }
            </div>
        </div>
    </>
}

export default TraitsView;
