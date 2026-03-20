/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useMemo, useState } from 'react';
import { IntlShape, useIntl } from 'react-intl';

interface MapLayerControlsProps {
    facets: string[];
    defaultColourBy: string;
    defaultSize: number;
    defaultOpacity: number;
    defaultOutline: boolean;
    onColourChange: (value: string) => void;
    onSizeChange: (value: number) => void;
    onOpacityChange: (value: number) => void;
    onOutlineChange: (checked: boolean) => void;
}

function MapLayerControls({
                                     facets,
                                     defaultColourBy,
                                     defaultSize,
                                     defaultOpacity,
                                     defaultOutline,
                                     onColourChange,
                                     onSizeChange,
                                     onOpacityChange,
                                     onOutlineChange,
                                 }: MapLayerControlsProps) {
    const intl: IntlShape = useIntl();

    const [sizeValue, setSizeValue] = useState<number>(defaultSize);
    const [opacityValue, setOpacityValue] = useState<number>(defaultOpacity);
    const [outlineChecked, setOutlineChecked] = useState<boolean>(defaultOutline);
    const [colourByValue, setColourByValue] = useState<string>(defaultColourBy);


    const formattedFacets = useMemo(() => {
        return (facets || []).map((facet) => ({
            key: facet,
            label: intl.formatMessage({ id: 'facet.' + facet, defaultMessage: facet }),
        }));
    }, [facets, intl]);

    return (
        <div
            style={{
                display: 'flex',
                gap: '10px',
                background: '#fff',
                padding: '8px',
                borderRadius: '6px',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <div>
                <label htmlFor="colourBySelect">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td01.label', defaultMessage: 'Colour by' })}:&nbsp;</label>
                <select
                    id="colourBySelect"
                    value={colourByValue}
                    onChange={(e) => {
                        setColourByValue(e.target.value);
                        onColourChange(e.target.value);
                    }}
                >
                    <option value="">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td01.option01', defaultMessage: 'Points - default colour' })}</option>
                    <option value="grid">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td01.option02', defaultMessage: 'Record density grid' })}</option>
                    <option disabled>————————————</option>
                    {formattedFacets.map((facet) => (
                        <option key={facet.key} value={facet.key}>
                            {facet.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="sizeslider">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td02.label', defaultMessage: 'Size' })}:</label>
                <span id="sizeslider-val">{sizeValue}</span>
                <input
                    id="sizeslider"
                    type="range"
                    min={1}
                    max={6}
                    value={sizeValue}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        setSizeValue(v);
                        onSizeChange(v);
                    }}
                    style={{ width: '75px', marginLeft: '5px'}}
                />
            </div>

            <div>
                <label htmlFor="opacityslider">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td03.label', defaultMessage: 'Opacity' })}:</label>
                <span id="opacityslider-val">{opacityValue.toFixed(1)}</span>
                <input
                    id="opacityslider"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={opacityValue}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        setOpacityValue(v);
                        onOpacityChange(v);
                    }}
                    style={{ width: '75px', marginLeft: '5px'}}
                />
            </div>

            <div>
                <label htmlFor="outlineDots">{intl.formatMessage({ id: 'map.maplayercontrols.tr01td04.label', defaultMessage: 'Outline' })}:</label>
                <input
                    id="outlineDots"
                    type="checkbox"
                    checked={outlineChecked}
                    onChange={(e) => {
                        setOutlineChecked(e.target.checked);
                        onOutlineChange(e.target.checked);
                    }}
                    style={{ marginLeft: '5px'}}
                />
            </div>
        </div>
    );
}

export default MapLayerControls;

