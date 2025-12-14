/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {FormattedMessage} from "react-intl";
import {RecordResult} from "../../api/model.tsx";

function OutlierFeedback({record}: { record: RecordResult }) {
    const [metadataForOutlierLayers, setMetadataForOutlierLayers] = useState<any[]>([]);

    useEffect(() => {
        fetchMetadata();
    }, [record]);

    // Fetch metadata for each outlier layer
    function fetchMetadata() {
        // build query
        const outlierForLayers = record?.processed?.occurrence?.outlierForLayers;
        if (!outlierForLayers || outlierForLayers.length === 0) {
            return;
        }

        Promise.all(
            outlierForLayers.map((layer: any) =>
                fetch(`${import.meta.env.VITE_APP_SPATIAL_SERVICE_URL}/layer/${layer.substring(2)}`, {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'}
                }).then(response => response.json())
            )
        ).then(dataArray => {
            setMetadataForOutlierLayers(dataArray);
        });
    }

    if (!record?.processed?.occurrence?.outlierForLayers || record.processed.occurrence.outlierForLayers.length === 0) {
        return null;
    }

    return (
        <div id="outlierInformation" className="additionalData">
            <h3><FormattedMessage id={"show.outlierinformation.title"} defaultMessage="Outlier information"/></h3>
            <p>
                <FormattedMessage id={"show.outlierinformation.p01"}
                                  defaultMessage="This record has been detected as an outlier using the"/>
                &nbsp;<a
                href="https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/DETECTED_OUTLIER_JACKKNIFE">
                <FormattedMessage id={"show.outlierinformation.p.vavigator"}
                                  defaultMessage={"Reverse Jackknife algorithm"}/>
            </a>
                &nbsp;<FormattedMessage id={"show.outlierinformation.p02"} defaultMessage="for the following layers"/>
                :
            </p>
            <ul>
                {metadataForOutlierLayers && metadataForOutlierLayers.map((layerMetadata: any, idx: number) => (
                    <li key={idx}>
                        <a href={`${import.meta.env.VITE_APP_SPATIAL_SERVICE_URL}/layers/view/more/${layerMetadata.name}`}>
                            {layerMetadata.displayname} - {layerMetadata.source}</a><br/>
                        <FormattedMessage id={"show.outlierinformation.each.label01"} defaultMessage={"Notes"}/>
                        : {layerMetadata.description}<br/>
                        <FormattedMessage id={"show.outlierinformation.each.label02"} defaultMessage={"Scale"}/>
                        : {layerMetadata.scale}
                    </li>
                ))}
            </ul>

            <div style={{marginTop: "20px"}}>
                <FormattedMessage id="show.outlierinformation.p.label"
                                  defaultMessage="More information on the data quality work being undertaken by the Atlas is available here"/>
                :
                <ul>
                    <li><a href={import.meta.env.VITE_JACKKNIFE_INFO_URL}>{import.meta.env.VITE_JACKKNIFE_INFO_URL}</a>
                    </li>
                    <li><a href={import.meta.env.VITE_OUTLIER_INFO_URL}>
                        <FormattedMessage id="show.outlierinformation.p.li02"
                                          defaultMessage="Notes on Methods for Detecting Spatial Outliers"/>
                    </a></li>
                </ul>
            </div>
        </div>
    );
}

export default OutlierFeedback;
