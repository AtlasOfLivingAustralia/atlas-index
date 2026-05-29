/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FontAwesomeIconLite} from "@ala/common-ui";
import {faList} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from 'react';
import {FormattedMessage} from "react-intl";

interface MapLayerControlsProps {
    colourBy: string;
    facets?: any[];
    legendUrl?: string;
    setHiddenFacets: (indexes: number[]) => void;
}

function LegendImage({ legendUrl }: { legendUrl: string }) {
    const [loading, setLoading] = useState(true);

    return (
        <div>
            {loading && <span className="spinner-border" style={{width: '14px', height: '14px'}}/>}
            <img
                src={legendUrl}
                alt="Legend"
                style={loading ? { visibility: 'hidden' } : {}}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
            />
        </div>
    );
}

function MapLegendControls({ colourBy, facets, legendUrl, setHiddenFacets }: MapLayerControlsProps) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [hiddenFacets, setHiddenFacetsState] = useState<number[]>([]);

    useEffect(() => {
        setHiddenFacetsState([]);
        setIsOpen(false);
    }, [facets]);

    return (
        <div id='mapLegendControls' style={{ background: '#fff', padding: '8px', borderRadius: '6px' }}>
            {!isOpen ? (
                <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', width: '20px', height: '20px', textAlign: 'center', lineHeight: '20px' }}>
                    <FontAwesomeIconLite icon={faList} style={{ height: '20px', width: '20px' }} />
                </div>
            ) : (
                <div style={{ display: 'flex'}}>
                    <table>
                        <tbody>
                        {colourBy != 'grid' && colourBy != '-1' && facets && facets.map((facet, index) => (
                                <tr key={index}>
                                    <td>
                                        <input
                                            id={`facetCheckbox-${index}`}
                                            type='checkbox'
                                            checked={!hiddenFacets.includes(index)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    const newHiddenFacets = hiddenFacets.filter(i => i !== index);
                                                    setHiddenFacetsState(newHiddenFacets);
                                                    setHiddenFacets(newHiddenFacets);
                                                    return;
                                                }
                                                const newHiddenFacets = [...hiddenFacets, index];
                                                setHiddenFacetsState(newHiddenFacets);
                                                setHiddenFacets(newHiddenFacets);
                                            }}
                                        />
                                    </td>
                                    <td><div style={{backgroundColor: `rgb(${facet.red}, ${facet.green}, ${facet.blue})`, width: '14px', height: '14px'}}></div></td>
                                    <td>
                                        <label htmlFor={`facetCheckbox-${index}`}>{facet.name}</label>
                                    </td>
                                </tr>
                            ))}
                        {colourBy == 'grid' && legendUrl && <tr><td><LegendImage legendUrl={legendUrl} /></td></tr>}
                        {(colourBy == '' || colourBy == '-1') && (
                            <tr>
                                <td><div style={{backgroundColor:'#df4a21', width: '14px', height: '14px'}}></div></td>
                                <td><FormattedMessage id='map.all.records' defaultMessage='All records'/></td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                    <div onClick={() => setIsOpen(false)} style={{ fontWeight: 'bold', cursor: 'pointer', paddingLeft: '5px' }}>X</div>
                </div>
            )}
        </div>
    );
}

export default MapLegendControls;
