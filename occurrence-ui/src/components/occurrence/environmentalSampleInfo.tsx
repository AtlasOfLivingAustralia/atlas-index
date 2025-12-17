/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { RecordResult } from '../../api/model.tsx';

interface LayerItem {
    id?: string;
    name?: string;
    displayName?: string;
    value?: any;
    units?: string;
    classification?: string;
}

function EnvironmentSampleInfo({ record }: { record: RecordResult }) {
    const [clLayerInfo, setClLayerInfo] = useState<LayerItem[]>([]);
    const [elLayerInfo, setElLayerInfo] = useState<LayerItem[]>([]);

    useEffect(() => {
        getLayerInfo();
    }, [record]);

    function getLayerInfo() {
        let newElLayerInfo: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(record?.processed?.el || {})) {
            newElLayerInfo[key] = { value: value, name: key, id: key };
        }

        let newClLayerInfo: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(record?.processed?.cl || {})) {
            newClLayerInfo[key] = { value: value, name: key, id: key };
        }

        fetch(`${import.meta.env.VITE_APP_SPATIAL_SERVICE_URL}/fields/search`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                // merge in additional layer info
                for (const item of data) {
                    if (item.id in newElLayerInfo) {
                        let newLayer = newElLayerInfo[item.id];
                        newLayer.units = item.layer.environmentalvalueunits;
                        newLayer.displayName = item.name;
                        newLayer.name = item.layer.name;
                        newLayer.classification = item.layer.classification1;
                    }
                    if (item.id in newClLayerInfo) {
                        let newLayer = newClLayerInfo[item.id];
                        newLayer.units = item.layer.environmentalvalueunits;
                        newLayer.displayName = item.name;
                        newLayer.name = item.layer.name;
                        newLayer.classification = item.layer.classification1;
                    }
                }

                // convert to lists, sorted, with classification headers
                let prevClassification = '';

                let elLayerInfo: LayerItem[] = [];
                Object.values(newElLayerInfo)
                    .sort((a, b) => {
                        if (a.classification === b.classification) {
                            return (a.displayName || '').localeCompare(b.displayName || '');
                        }
                        return (a.classification || '').localeCompare(b.classification || '');
                    })
                    .forEach(item => {
                        if (item.classification !== prevClassification) {
                            elLayerInfo.push({ displayName: item.classification });
                            prevClassification = item.classification;
                        }
                        elLayerInfo.push(item);
                    });

                let clLayerInfo: LayerItem[] = [];
                Object.values(newClLayerInfo)
                    .sort((a, b) => {
                        if (a.classification === b.classification) {
                            return (a.displayName || '').localeCompare(b.displayName || '');
                        }
                        return (a.classification || '').localeCompare(b.classification || '');
                    })
                    .forEach(item => {
                        if (item.classification !== prevClassification) {
                            clLayerInfo.push({ displayName: item.classification });
                            prevClassification = item.classification;
                        }
                        clLayerInfo.push(item);
                    });

                setElLayerInfo(elLayerInfo);
                setClLayerInfo(clLayerInfo);
            });
    }

    return (
        <>
            {clLayerInfo.length > 0 && (<>
                <h3 id='contextualSampleInfo'>
                    <FormattedMessage id='show.outlierinformation.02.title01' defaultMessage='Additional geographic & environmental information' />
                </h3>
                <table className='occurrenceTable table table-bordered table-condensed ala-table-striped'>
                    <tbody>
                        {clLayerInfo.map((item: LayerItem, idx: number) => (
                            <tr key={idx}>
                                {!item.id ? (
                                    <td colSpan={2} className={'sectionName'}><b>{item.displayName}</b></td>
                                ) : (
                                    <>
                                        <td>
                                            <a href={`${import.meta.env.VITE_APP_SPATIAL_URL}/layers/view/more/${item.name}`} title='More information about this layer'>
                                                <FormattedMessage id={item.id} defaultMessage={item.displayName} />
                                            </a>
                                        </td>
                                        <td>
                                            {item.value} {item.units && !item.units.toLowerCase().includes('dimensionless') ? item.units : ''}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>)}

            {elLayerInfo.length > 0 && (<>
                <h3 id='environmentalSampleInfo'>
                    <FormattedMessage id='show.outlierinformation.02.title02' defaultMessage='Environmental sampling for this location' />
                </h3>
                <table className='occurrenceTable table table-bordered table-condensed ala-table-striped'>
                    <tbody>
                        {elLayerInfo.map((item: LayerItem, idx: number) => (
                            <tr key={idx}>
                                {!item.id ? (
                                    <td colSpan={2} className={'sectionName'}><b>{item.displayName}</b></td>
                                ) : (
                                    <>
                                        <td>
                                            <a href={`${import.meta.env.VITE_APP_SPATIAL_URL}/layers/view/more/${item.name}`} title='More information about this layer'>
                                                <FormattedMessage id={item.id} defaultMessage={item.displayName} />
                                            </a>
                                        </td>
                                        <td>
                                            {item.value} {item.units && !item.units.toLowerCase().includes('dimensionless') ? item.units : ''}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>)}
        </>
    );
}

export default EnvironmentSampleInfo;
