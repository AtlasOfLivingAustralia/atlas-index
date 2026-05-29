/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ArcElement, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { useEffect, useState } from 'react';
import { IntlShape, useIntl } from 'react-intl';
import chartConfig from '../../config/charts.json';
import {getQc} from "../../util/util.tsx";
import HorizontalBarChart from './horizontalBarChart.tsx';
import PieChart from './pieChart.tsx';
import VerticalBarChart from './verticalBarChart.tsx';

Chart.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

interface ChartsProps {
    queryString?: string;
    chartsData: { data: number[]; labels: string[]; urls: string[] | undefined }[];
    setChartsData: React.Dispatch<React.SetStateAction<{ data: number[]; labels: string[]; urls: string[] | undefined }[]>>;
}

// data is stored in the caller component to avoid refetching when Charts re-renders on tab switch, etc
function Charts({ queryString, chartsData, setChartsData }: ChartsProps) {
    const [activeQueryString, setActiveQueryString] = useState(queryString); // used to detect changes in queryString and reset chartsData
    const intl: IntlShape = useIntl();

    useEffect(() => {
        if (!queryString) {
            return;
        }

        let thisChartsData = chartsData;
        if (queryString !== activeQueryString) {
            setActiveQueryString(queryString);

            // reset charts data to force refetch
            setChartsData([]);
            thisChartsData = [];
        }

        if (!thisChartsData) {
            fetchData(0);
        } else {
            // find the first empty index and fetch from there
            let startIndex = 0;
            for (let i = 0; i < thisChartsData.length; i++) {
                if (!thisChartsData[i]) {
                    startIndex = i;
                    break;
                }
            }
            fetchData(startIndex);
        }
    }, [queryString]);

    function fetchData(configIndex: number) {
        if (configIndex >= (chartConfig ? chartConfig.length : 0)) {
            return;
        }

        const config = chartConfig[configIndex];
        let url = import.meta.env.VITE_APP_BIOCACHE_URL + '/chart' + queryString + '&x=' + config.facet + '&xother=false&xmissing=false' + '&fq=' + config.facet + ':*' + getQc(); // this excludes records with no value for the facet, but the API is supposed to do that when xmissing=false
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                let counts = [];
                let labels = [];
                let urls = [];
                for (let i = 0; i < data.data[0].data.length; i++) {
                    // exclude the "no value" facet
                    if (data.data[0].data[i].fq.endsWith('*')) {
                        continue;
                    }
                    counts.push(data.data[0].data[i].count);
                    labels.push(intl.formatMessage({ id: data.data[0].data[i].i18nCode, defaultMessage: data.data[0].data[i].label }));
                    urls.push('/occurrences/search' + queryString + '&fq=' + data.data[0].data[i].fq);
                }
                const chartData = {
                    data: counts,
                    labels: labels,
                    urls: urls
                };
                setChartsData(prevData => {
                    const newData = [...prevData];
                    newData[configIndex] = chartData;
                    return newData;
                });

                fetchData(configIndex + 1);
            });
    }

    return (
        <div className='container-fluid'>
            <div className={'row mt-4'}>
                {chartConfig &&
                    chartConfig.map((config, index) => (
                        <div key={index} className={'col-6 mb-5'}>
                            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '10px' }}>{config.label}</div>
                            {chartsData[index] ? (
                                config.type === 'pie' ? (
                                    <PieChart key={index} data={chartsData[index].data} labels={chartsData[index].labels} urls={chartsData[index].urls} />
                                ) : config.type === 'horizontalBar' ? (
                                    <HorizontalBarChart key={index} data={chartsData[index].data} labels={chartsData[index].labels} urls={chartsData[index].urls} />
                                ) : config.type === 'verticalBar' ? (
                                    <VerticalBarChart key={index} data={chartsData[index].data} labels={chartsData[index].labels} urls={chartsData[index].urls} />
                                ) : null
                            ) : (
                                <div className='spinner-border' />
                            )}
                        </div>
                    ))}
            </div>
        </div>
    );
}

export default Charts;
