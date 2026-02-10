/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartOptions, ChartData, Chart as ChartJS } from 'chart.js';

const defaultOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        x: {
            beginAtZero: true
        }
    }
};

interface HorizontalBarChartProps {
    data: number[];
    labels: string[];
    urls: string[] | undefined;
    options?: ChartOptions<'bar'>;
}

function HorizontalBarChart({ data, labels, urls, options = defaultOptions }: HorizontalBarChartProps) {
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !chart.canvas) return;

        const canvas = chart.canvas;

        const handleMouseMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const yScale = chart.scales.y;
            const xScale = chart.scales.x;

            // Check if mouse is over the y-axis label area (left of where bars start)
            const chartAreaLeft = chart.chartArea.left;
            if (mouseX < chartAreaLeft && mouseX > 0 && mouseY >= chart.chartArea.top && mouseY <= chart.chartArea.bottom) {
                let hoveredIndex = -1;
                yScale.ticks.forEach((_, i) => {
                    const y = yScale.getPixelForTick(i);
                    const tickHeight = yScale.height / yScale.ticks.length;
                    if (mouseY > y - tickHeight / 2 && mouseY < y + tickHeight / 2) {
                        hoveredIndex = i;
                    }
                });

                if (hoveredIndex !== -1) {
                    const activeElement = { datasetIndex: 0, index: hoveredIndex };
                    chart.setActiveElements([activeElement]);

                    const barValue = data[hoveredIndex];
                    const barX = xScale.getPixelForValue(barValue);
                    const barY = yScale.getPixelForValue(hoveredIndex);

                    chart.tooltip?.setActiveElements([activeElement], { x: barX, y: barY });
                    chart.update('none');
                    canvas.style.cursor = 'pointer';
                    return;
                }
            }

            // Clear if not over label
            chart.setActiveElements([]);
            chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
            chart.update('none');
            canvas.style.cursor = 'default';
        };

        const handleCanvasClick = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const yScale = chart.scales.y;

            // Check if click is over the y-axis label area
            const chartAreaLeft = chart.chartArea.left;
            if (mouseX < chartAreaLeft && mouseX > 0 && mouseY >= chart.chartArea.top && mouseY <= chart.chartArea.bottom) {
                let clickedIndex = -1;
                yScale.ticks.forEach((_, i) => {
                    const y = yScale.getPixelForTick(i);
                    const tickHeight = yScale.height / yScale.ticks.length;
                    if (mouseY > y - tickHeight / 2 && mouseY < y + tickHeight / 2) {
                        clickedIndex = i;
                    }
                });

                if (clickedIndex !== -1 && urls && urls[clickedIndex]) {
                    window.location.assign(import.meta.env.VITE_APP_BASE_URL + urls[clickedIndex]);
                }
            }
        };

        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('click', handleCanvasClick);
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('click', handleCanvasClick);
        };
    }, [chartRef.current, data, labels, urls]);

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
        <div style={{ width: '100%', height: Math.max(data.length * 20 + 40, 120)}}>
            <Bar ref={chartRef} data={chartData} options={options} onClick={handleClick} />
        </div>
    );
}

export default HorizontalBarChart;
