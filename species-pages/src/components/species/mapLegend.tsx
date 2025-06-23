/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo } from 'react'

interface LegendProps {
    colour: string;
    lower: number | string;
    upper: number | string;
}

function Legend({ fillOpacity, hexBinValues }: { fillOpacity: number, hexBinValues: [string, number | null][] }) {
    const maxGridCount = 5;
    const gridWidth = 45;
    const gridHeight = 18;

    const extractValues = useCallback((hexBinValues: [string, number | null][]) => {
        const colours: Record<number, string> = {}
        const maxCount = Math.max(...hexBinValues.map(([, count]) => count || 0)) * 10
        hexBinValues.forEach(([hex, count]) => {
            if (count) {
                colours[count] = `#${hex.substring(0, 6)}` // remove alpha channel
            } else {
                colours[maxCount] = `#${hex.substring(0, 6)}` // remove alpha channel
            }
        })

        return colours
    }, [hexBinValues]);

    const colours = extractValues(hexBinValues);

    const legendEntries: LegendProps[] = useMemo(() => {
        return Object.keys(colours).slice(0, maxGridCount).map((count, index) => {
            const lower = (Number(Object.keys(colours)[index - 1] || 0) + 1).toLocaleString();
            const upper = Number(count).toLocaleString();
            const colour = colours[Number(count)];
            return { colour, lower, upper };
        });
    }, [colours, maxGridCount]);


    return (
        <div style={{ borderRadius: '8px', backdropFilter: 'blur(5px)', marginBottom: "5px", marginLeft: "30px" }}>
            <div className="d-flex justify-content-center">
                <span className="text-black" style={{fontSize: "14px"}}>Number of species records</span>
            </div>
            <div
                className="row justify-content-around align-items-end"
                style={{
                    height: `${gridHeight}px`,
                    width: `${gridWidth * maxGridCount}px`,
                    background: `linear-gradient(to right, ${legendEntries[0].colour}, ${legendEntries[4].colour})`,
                    opacity: fillOpacity
                }}
            >
            </div>
            <style>
                {`
                    .map-legend-label::before {
                        content: '';
                        position: absolute;
                        top: -10px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 2px;
                        height: 10px;
                        background: white;
                        z-index: 1;
                    }
                `}
            </style>
            <div className="row" style={{ width: `${gridWidth * maxGridCount}px` }}>
                {legendEntries.map((entry, idx) => (
                    <div
                        key={idx}
                        className="col map-legend-label text-center"
                        style={{
                            maxWidth: `${gridWidth}px`,
                            fontSize: '12px',
                            color: 'black',
                            position: 'relative'
                        }}
                    >
                        {entry.upper}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Legend
