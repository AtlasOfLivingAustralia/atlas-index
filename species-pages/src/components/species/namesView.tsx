/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import '../../css/nameFormatting.css';
import InfoBox from "../common-ui/infoBox.tsx";
import classes from "./species.module.css";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>
}

function NamesView({result}: MapViewProps) {

    const [commonNames, setCommonNames] = useState<any[]>([]);
    const [indigenousNames, setIndigenousNames] = useState<any[]>([]);

    useEffect(() => {
        if (result?.vernacularData) {
            setCommonNames(result.vernacularData.filter((item: any) => item.status !== 'traditionalKnowledge'));
            setIndigenousNames(result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge'));
        }
    }, [result]);

    return <>
        <div>
            <span className={classes.speciesDescriptionTitle}>Scientific names</span>
            <div style={{height: "30px"}}/>
            <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                <thead>
                <tr>
                    <th>Accepted name</th>
                    <th style={{width: "30%"}}>Source</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td>
                        <span dangerouslySetInnerHTML={{__html: result?.nameFormatted}}/>
                        {result?.nameAccordingTo && (
                            <>
                                <div style={{height: "10px"}}/>
                                <span style={{fontStyle: "italic"}}>
                          According to: {result?.nameAccordingTo}
                        </span>
                            </>
                        )}
                        {result?.namePublishedIn && (
                            <>
                                <div style={{height: "10px"}}/>
                                <span style={{fontStyle: "italic"}}>
                          Published in: {result?.namePublishedIn}
                        </span>
                            </>
                        )}
                    </td>
                    <td>
                        <a href={result?.source} style={{color: "#003A70", textDecoration: "underline"}}>
                            {result?.datasetName}
                        </a>
                    </td>
                </tr>
                </tbody>
            </table>
            <div style={{height: "30px"}}/>

            {result?.synonymData && <>
                <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                    <thead>
                    <tr>
                        <th>Synonyms</th>
                        <th style={{width: "30%"}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.synonymData
                        .sort((a: any, b: any) => a.nameFormatted.localeCompare(b.nameFormatted))
                        .map((item: any, idx: any) => (
                            <tr key={idx}>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            dangerouslySetInnerHTML={{__html: item.nameFormatted}}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        />
                                    ) : (
                                        <span dangerouslySetInnerHTML={{__html: item.nameFormatted}}/>
                                    )}
                                    {item.nameAccordingTo && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                  According to: {item.nameAccordingTo}
                                </span>
                                        </>
                                    )}
                                    {item.namePublishedIn && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                  Published in: {item.namePublishedIn}
                                </span>
                                        </>
                                    )}
                                </td>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.datasetName || "Link"}
                                        </a>
                                    ) : (
                                        <span>{item?.datasetName}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{height: "30px"}}/>
            </>
            }

            {result?.variantData && <>
                <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                    <thead>
                    <tr>
                        <th>Variants</th>
                        <th style={{width: "30%"}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.variantData
                        .sort((a: any, b: any) => a.nameFormatted.localeCompare(b.nameFormatted))
                        .map((item: any, idx: any) => (
                            <tr key={idx}>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            dangerouslySetInnerHTML={{__html: item.nameFormatted}}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        />
                                    ) : (
                                        <span dangerouslySetInnerHTML={{__html: item.nameFormatted}}/>
                                    )}
                                    {item.nameAccordingTo && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                  According to: {item.nameAccordingTo}
                                </span>
                                        </>
                                    )}
                                    {item.namePublishedIn && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                  Published in: {item.namePublishedIn}
                                </span>
                                        </>
                                    )}
                                </td>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.datasetName || "Link"}
                                        </a>
                                    ) : (
                                        <span>{item?.datasetName}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{height: "30px"}}/>
            </>
            }

            {result?.identifierData && <>
                <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                    <thead>
                    <tr>
                        <th>Identifiers</th>
                        <th style={{width: "30%"}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {result.identifierData
                        .sort((a: any, b: any) => a.guid.localeCompare(b.guid))
                        .map((item: any, idx: any) => (
                            <tr key={idx}>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.guid}
                                        </a>
                                    ) : (
                                        <span>{item.guid}</span>
                                    )}
                                    {item.nameAccordingTo && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                              According to: {item.nameAccordingTo}
                            </span>
                                        </>
                                    )}
                                    {item.namePublishedIn && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                              Published in: {item.namePublishedIn}
                            </span>
                                        </>
                                    )}
                                </td>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.datasetName || "Link"}
                                        </a>
                                    ) : (
                                        <span>{item?.datasetName}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{height: "30px"}}/>
            </>
            }

            {commonNames && commonNames.length > 0 && <>
                <hr/>
                <div style={{height: "30px"}}/>
                <span className={classes.speciesDescriptionTitle}>Common names</span>
                <div style={{height: "30px"}}/>
                <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                    <thead>
                    <tr>
                        <th>Common name</th>
                        <th style={{width: "30%"}}>Source</th>
                    </tr>
                    </thead>
                    <tbody>
                    {commonNames
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                        .map((item: any, idx: any) => (
                            <tr key={idx}>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.name}
                                        </a>
                                    ) : (
                                        <span>{item.name}</span>
                                    )}
                                    {item.nameAccordingTo && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                      According to: {item.nameAccordingTo}
                                    </span>
                                        </>
                                    )}
                                    {item.namePublishedIn && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                      Published in: {item.namePublishedIn}
                                    </span>
                                        </>
                                    )}
                                </td>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{textDecoration: "underline", color: "#003A70"}}
                                        >
                                            {item?.datasetName || "Link"}
                                        </a>
                                    ) : (
                                        <span>{item?.datasetName}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{height: "30px"}}/>
            </>
            }

            {indigenousNames && indigenousNames.length > 0 && <>
                <hr/>
                <div style={{height: "30px"}}/>
                <span className={classes.speciesDescriptionTitle}>Indigenous names</span>
                <div style={{height: "30px"}}/>
                <InfoBox className="mb-2" icon={faCircleInfo} title="About indigenous names" content={<>The links from the Indigenous name provide more information about Indigenous Ecological
                    Knowledge (IEK) relating to the species. The link from language group links to the
                    Australian Institute of Aboriginal and Torres Strait Islander Studies
                    (<a href="https://aiatsis.gov.au" target="_blank"
                        style={{color: "#003A70", textDecoration: "underline"}}>AIATSIS</a>)
                    information about the language.</>}
                />
                <div style={{height: "30px"}}/>
                <table className="table table-striped align-middle" style={{fontSize: "16px", lineHeight: "24px"}}>
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th style={{width: "30%"}}>See language group</th>
                    </tr>
                    </thead>
                    <tbody>
                    {indigenousNames
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                        .map((item: any, idx: any) => (
                            <tr key={idx}>
                                <td>
                                    {item?.source ? (
                                        <a
                                            href={item?.source}
                                            style={{color: "#003A70", textDecoration: "underline"}}
                                        >
                                            {item?.name}
                                        </a>
                                    ) : (
                                        <span>{item.name}</span>
                                    )}
                                    {item.nameAccordingTo && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                                    According to: {item.nameAccordingTo}
                                                </span>
                                        </>
                                    )}
                                    {item.namePublishedIn && (
                                        <>
                                            <div style={{height: "10px"}}/>
                                            <span style={{fontStyle: "italic"}}>
                                                    Published in: {item.namePublishedIn}
                                                </span>
                                        </>
                                    )}
                                </td>
                                <td>
                                    {item?.languageURL ? (
                                        <a
                                            href={item?.languageURL}
                                            style={{color: "#003A70", textDecoration: "underline"}}
                                        >
                                            {item?.languageName || item?.language}
                                        </a>
                                    ) : (
                                        <span>{item?.languageName || item?.language}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>
            }
        </div>
    </>
}

export default NamesView;
