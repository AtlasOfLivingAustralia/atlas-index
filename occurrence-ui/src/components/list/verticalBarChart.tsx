/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartOptions, ChartData, Chart as ChartJS } from 'chart.js';

const defaultOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        y: {
            beginAtZero: true
        }
    }
};

interface VerticalBarChartProps {
    data: number[];
    labels: string[];
    urls: string[] | undefined;
    options?: ChartOptions<'bar'>;
}

function VerticalBarChart({ data, labels, urls, options = defaultOptions }: VerticalBarChartProps) {
    const chartRef = useRef<ChartJS<'bar'>>(null);

    const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const chart = chartRef.current;
        if (!chart) return;
        const points = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const index = firstPoint.index;
            if (urls && urls[index]) {
                window.location.assign(import.meta.env.VITE_APP_BASE_URL + urls[index]);
            }
        }
    };

    const chartData: ChartData<'bar'> = {
        labels,
        datasets: [
            {
                data,
                backgroundColor: 'rgba(151, 187, 205, 0.5)',
                borderColor: 'rgba(151, 187, 205, 1.0)',
                borderWidth: 1
            }
        ]
    };

    return (
        <div style={{ width: '100%', height: '400px' }}>
            <Bar ref={chartRef} data={chartData} options={options} onClick={handleClick} />
        </div>
    );
}

export default VerticalBarChart;
