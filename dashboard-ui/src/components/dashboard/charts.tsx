/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Bar, Pie} from "react-chartjs-2";
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Colors,
    Legend,
    LinearScale,
    LogarithmicScale,
    Tooltip
} from "chart.js";
import {useIntl} from "react-intl";

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, Colors, CategoryScale, LinearScale, LogarithmicScale);

const customColors = [
    '#003A70', '#F26649', '#6BDAD5', '#EB9D07', '#A191B2', '#FFC557', '#D9D9D9'
];

const DashboardChart = (dat: any) => {
    const table = dat.rows

    const {formatMessage} = useIntl();

    let chartData: any[] = []
    let labels: any[] = []
    let url: any[] = []

    const options = {
        plugins: {
            tooltip: {
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 12
                },
            },
            legend: {
                display: true,
                responsive: true,
                position: "right",
                labels: {
                    boxWidth: 36,
                    padding: 5,
                    font: {
                        size: 12
                    },
                },
                align: "center",
            }
        },
        maintainAspectRatio: false,
        // @ts-ignore
        onClick(_event: any, elements: any) {
            if (elements.length === 1) {
                const selected = url[elements[0].index];
                window.open(selected, '_blank');
            }
        }
    };

    for (let i = 0; i < table[0].rows.length; i++) {
        chartData.push(table[0].rows[i].values[0])
        let item = table[0].rows[i].name
        labels.push(formatMessage({id: item}))
        url.push(table[0].rows[i].url)
    }

    let chart = {
        labels: labels,
        datasets: [
            {
                data: chartData,
                borderWidth: 1,
                backgroundColor: customColors,
            },
        ],
    };

    return <div>
        <Pie
            data={chart}
            height={349} // Height is adjusted to best fit the panel without a scroll bar
            width={400}
            // @ts-ignore
            options={options}
        />
    </div>
}

const DashboardBarChart = (dat: any) => {
    const table = dat.rows

    const {formatMessage} = useIntl();

    let labels: any[] = []
    let url: any[] = []
    let chartData1: any[] = []
    let chartData2: any[] = []

    const options = {
        plugins: {
            tooltip: {
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 12
                },
            },
            legend: {
                display: true
            }
        },
        scales: {
            x: {
                display: true,
            },
            y: {
                display: true,
                type: 'logarithmic',
            }
        },
        maintainAspectRatio: false,
        onClick(_event: any, elements: any) {
            if (elements.length === 1) {
                const selected = url[elements[0].index];
                window.open(selected, '_blank');
            }
        }
    };

    for (let i = 0; i < table[0].rows.length; i++) {
        labels.push(table[0].rows[i].name)
        url.push(table[0].rows[i].url)

        chartData1.push(table[0].rows[i].values[0])
        chartData2.push(table[0].rows[i].values[1])
    }

    let header1 = table[0].header[1]
    let header2 = table[0].header[2]
    let chart = {
        labels: labels,
        datasets: [
            {
                label: formatMessage({id: header1}),
                data: chartData1,
                borderWidth: 1,
                backgroundColor: customColors[0],
            },
            {
                label: formatMessage({id: header2}),
                data: chartData2,
                borderWidth: 1,
                backgroundColor: customColors[1],
            }
        ],
    };


    return <div>
        <Bar
            data={chart}
            width={455}
            height={349} // Height is adjusted to best fit the panel without a scroll bar
            // @ts-ignore
            options={options}
        />
    </div>
}

export {DashboardChart, DashboardBarChart};
