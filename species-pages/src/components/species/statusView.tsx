/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {openUrl} from "../search/util.tsx";
import InfoBox from "../common-ui/infoBox.tsx";
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import {ConservationStatusKey, ConservationStatusLabel} from "../common-ui/conservationStatusLabel.tsx";
import classes from "./species.module.css";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>
}

interface ConservationItem {
    name?: string;
    status?: string;
    iucn?: string;
}

interface NativeIntroducedItem {
    [key: string]: string;
}

const iucnStatusMapping = {
    "Extinct": "EX",
    "Extinct in the Wild": "EW",
    "Critically Endangered": "CR",
    "Endangered": "EN",
    "Vulnerable": "VU",
    "Near Threatened": "NT",
    "Least Concern": "LC"
}

function StatusView({result}: MapViewProps) {

    const [nativeIntroduced, setNativeIntroduced] = useState<NativeIntroducedItem>({});
    const [conservationStatus, setConservationStatus] = useState<Record<string, ConservationItem>>({});

    useEffect(() => {
        if (result?.nativeIntroduced) {
            setNativeIntroduced(JSON.parse(result.nativeIntroduced));
        }

        var listNames = result?.listNames;

        var conservation: { [key: string]: ConservationItem } = {};
        result && Object.keys(result).map(key => {
            if (key.startsWith('iucn_')) {
                var listId = key.replace('iucn_', '').replace('_s', ''); // TODO: remove _s after updating elasticsearch mapping to create a pattern for "iucn_*"
                var item: ConservationItem = conservation[listId];
                if (!item) {
                    item = {};
                    conservation[listId] = item;
                }
                item["iucn"] = iucnStatusMapping[result[key] as keyof typeof iucnStatusMapping];
                item["name"] = listNames[listId];
            } else if (key.startsWith('conservation_')) {
                var listId = key.replace('conservation_', '');
                var item: ConservationItem = conservation[listId];
                if (!item) {
                    item = {};
                    conservation[listId] = item;
                }
                item["status"] = result[key];
                item["name"] = listNames[listId];
            }
        });

        if (conservation && Object.keys(conservation).length > 0) {
            console.log("conservation", conservation);
            setConservationStatus(conservation);
        }

    }, []);

    return <>
        <div>
            {nativeIntroduced && Object.keys(nativeIntroduced).length > 0 &&
                <>
                    <span className={classes.speciesDescriptionTitle} style={{marginBottom: "30px"}}>Native / introduced</span>
                    <InfoBox className="mb-2" icon={faCircleInfo} title="About native / introduced"
                             content={<>This indicates if a species is regarded as introduced to Australia, a state, or
                                 territory.
                                 This can also include Australian native species which have been introduced in areas
                                 beyond
                                 their natural range, e.g a species native to NSW introduced to WA.&nbsp;
                                 <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                    onClick={(e) => {
                                     e.preventDefault();
                                     openUrl(import.meta.env.VITE_ALA_NATIVE_INTRODUCED_INFO_URL);
                                 }}
                                    target="_blank">Find out more</a></>}
                    />
                    <table className="table table-striped align-middle" style={{marginTop: "30px", fontSize: "16px", lineHeight: "24px"}}>
                      <thead>
                        <tr>
                          <th>Place</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(nativeIntroduced).sort().map((key, idx) => (
                          <tr key={idx}>
                            <td>{key}</td>
                            <td>{nativeIntroduced[key]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {conservationStatus &&
                        <>
                            <div style={{height: "30px"}}/>
                            <hr/>
                            <div style={{height: "30px"}}/>
                        </>
                    }
                </>
            }

            {conservationStatus && Object.keys(conservationStatus).length > 0 &&
                <>
                    <span className={classes.speciesDescriptionTitle} style={{marginBottom: "30px"}}>Conservation status</span>
                    <InfoBox icon={faCircleInfo} title="About the IUCN Equivalent Classes"
                             style={{marginTop: "30px"}}
                             content={<>As each state and territory have different classifications under their
                                 threatened species
                                 legislation, the Atlas of Living Australia have interpreted state and territory status
                                 classes to align to the equivalent International Union for Conservation of Nature
                                 (IUCN) Classes. <a className={classes.speciesLink} style={{fontSize: "16px", lineHeight: "24px"}}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        openUrl(import.meta.env.VITE_SDS_INFO_URL)
                                                    }}
                                                    target="_blank">Find out more</a></>}
                    />
                    <table className="table table-striped align-middle" style={{marginTop: "30px", fontSize: "16px", lineHeight: "24px"}}>
                      <thead>
                        <tr>
                          <th>Level</th>
                          <th>Source status</th>
                          <th>IUCN equivalent class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conservationStatus && Object.keys(conservationStatus).sort().map((key: string, idx: number) =>
                          <tr key={idx}>
                            <td>{conservationStatus[key].name}</td>
                            <td>{conservationStatus[key].status}</td>
                            <td>
                              {conservationStatus[key].iucn &&
                                <ConservationStatusLabel
                                  status={conservationStatus[key].iucn as ConservationStatusKey}/>}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/*<div className="row" style={{marginTop: "30px", rowGap: "20px", paddingLeft: "20px", paddingRight: "20px"}}>*/}
                    {/*  {Object.values(iucnStatusMapping).map((key, idx) =>*/}
                    {/*      <div key={idx} className={"col-4"}>*/}
                    {/*        <ConservationStatusLabel status={key as ConservationStatusKey} withLabel />*/}
                    {/*      </div>*/}
                    {/*  )}*/}
                    {/*</div>*/}
                </>
            }

            {(!nativeIntroduced || Object.keys(nativeIntroduced).length == 0) &&
                (!conservationStatus || Object.keys(conservationStatus).length == 0) &&
                <span style={{fontSize: "16px"}}>No status information available.</span>
            }
        </div>
    </>
}

export default StatusView;
