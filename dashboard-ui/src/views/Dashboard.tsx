/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from 'react';
import {FormattedMessage, IntlProvider} from "react-intl";
import "../components/dashboard/dashboard.css";
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
} from 'chart.js';
import {Bar, Pie} from 'react-chartjs-2';
import TreeItem from "../components/dashboard/tree.jsx";
import FontAwesomeIcon from '../components/common-ui/fontAwesomeIconLite.tsx'
import {faDownload} from '@fortawesome/free-solid-svg-icons/faDownload'
import {faCode} from '@fortawesome/free-solid-svg-icons/faCode'
import {faSpinner} from "@fortawesome/free-solid-svg-icons/faSpinner";
import {formatNumber} from "../components/util/FormatNumber.tsx";

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, Colors, CategoryScale, LinearScale, LogarithmicScale);

const customColors = [
    '#003A70', '#F26649', '#6BDAD5', '#EB9D07', '#A191B2', '#FFC557', '#D9D9D9'
];

const DashboardPage = () => {
    const [dashboardData, setDashboardData] = useState();
    const [messages, setMessages] = useState();

    useEffect(() => {
        fetch(import.meta.env.VITE_APP_DASHBOARD_I18N_URL)
            .then(response => response.json())
            .then(data => setMessages(data));

        fetch(import.meta.env.VITE_APP_DASHBOARD_DATA_URL)
            .then(response => response.json())
            .then(data => {
                setDashboardData(data);
            });
    }, []);

    const DashboardTable = (data: any) => {
        let rows = data.rows.rows
        let header = data.header
        let italisizeName = (data.italisize !== undefined) ? data.italisize : false
        var headerElement = <></>
        if (header !== undefined && header != null) {
            if (header[2] === '') {
                header[2] = ' '
            }
            headerElement = <thead>
            <tr>
                <th>{header[0] && <FormattedMessage id={header[0]}/>}</th>
                <th className="text-end">{header[1] && <FormattedMessage id={header[1]}/>}</th>
                {header[2] &&
                    <th className="text-end ps-1"><FormattedMessage id={header[2]}/></th>
                }
                {header[3] &&
                    <th className="text-end ps-1"><FormattedMessage id={header[3]}/></th>
                }
                {header[4] &&
                    <th className="text-end ps-1"><FormattedMessage id={header[4]}/></th>
                }
            </tr>
            </thead>
        }

        function clickRow(url: string) {
            if (url !== undefined && url != null) {
                document.location.href = url
            }
        }

        return <table className="dashboardTable" style={{width: '100%'}}>
            {headerElement}
            <tbody>{
                rows.map((row: any, index: number) => {
                    var rowClass = ''
                    if (row.url !== undefined && row.url != null) {
                        rowClass = 'dashboardRowLink'
                    }
                    return <tr className={rowClass} key={index} onClick={() => clickRow(row.url)}>
                        <td>{!italisizeName ? (row.name && <FormattedMessage id={row.name}/>) :
                            (
                                <>
                                    <i>{row.name.split(' - ')[0]}</i>
                                    {row.name.indexOf(' - ') > 0 ? ' - ' + row.name.split(' - ')[1] : ''}
                                </>
                            )
                        }</td>
                        {row.values.map((v: any, index: number) =>
                            (header === undefined || header === null || index < header.length - 1) ?
                                <td key={index}>{formatNumber(v)}</td>
                                :
                                <React.Fragment key={index}></React.Fragment>
                        )}
                    </tr>
                })
            }</tbody>
        </table>
    }

    const DashboardKingdomTree = (data: any) => {
        let fieldResults: any[] = []
        data.rows.rows.map((row: any) => {
            fieldResults.push({fq: row.url, count: row.values[0], label: row.name})
        })

        return <TreeItem level={0} list={fieldResults}/>
    }

    const DashboardTables = (data: any) => {

        const [state, setState] = useState({
            select: 0
        });

        function changeSelect(e: any) {
            let newState = {
                select: e.target.selectedIndex
            }

            setState(newState)
        }

        var tables = data.tables

        return <>
            <div className={"dashboardSelectWrapper"}>
                <select onChange={(e) => changeSelect(e)}>
                    {
                        tables.map((table: any) => {
                            return <option value={table.name} key={table.name}>
                                <FormattedMessage id={table.name ? table.name : " "} defaultMessage={table.name}/>
                            </option>
                        })
                    }
                </select>
            </div>

            <DashboardTable rows={tables[state.select]} italisize={data.italisize}/>
        </>

    }

    const DashboardChart = (dat: any) => {
        const table = dat.rows

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
            onClick(event: any, elements: any) {
                if (elements.length === 1) {
                    const selected = url[elements[0].index];
                    window.open(selected, '_blank');
                }
            }
        };

        for (let i = 0; i < table[0].rows.length; i++) {
            chartData.push(table[0].rows[i].values[0])
            labels.push(formatMessage(table[0].rows[i].name))
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
            onClick(elements: any) {
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

        let chart = {
            labels: labels,
            datasets: [
                {
                    label: formatMessage(table[0].header[1]),
                    data: chartData1,
                    borderWidth: 1,
                    backgroundColor: customColors[0],
                },
                {
                    label: formatMessage(table[0].header[2]),
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

    function formatMessage(id: any) {
        let msg = messages && messages[id]
        return msg ? msg : id
    }

    const GridCard = (props: any) => {
        return (
            <div className='dashboardPanel card'>
                <div className={'dashboardPanelHeader card-header'}>
                    <h1 className="dashboardH1">{props.headerNum} {props.header}</h1>
                </div>
                <div className={"dashboardPanelBody card-body"}>
                    {props.children}
                </div>
            </div>
        )
    }

    function Dashboard(data: any) {
        data = data.data.data

        return (
            <div>
                <div className="d-flex">
                    <a className="btn btn-primary ms-auto" target="_blank"
                       href={import.meta.env.VITE_APP_DASHBOARD_ZIP_URL}><FontAwesomeIcon icon={faDownload}
                                                                                          className={"me-2"}/>Download
                        as CSV</a>
                    <a className="btn  btn-primary ms-2 me-5 " target="_blank"
                       href={import.meta.env.VITE_APP_DASHBOARD_DATA_URL}><FontAwesomeIcon icon={faCode}
                                                                                           className={"me-2"}/>Show raw
                        data</a>

                </div>
                <div className='d-flex flex-wrap justify-content-center'>
                    {data.occurrenceCount &&
                        <GridCard header={formatMessage('occurrenceRecordHeader')}>
                            <div className={"dashboardCenter"}>
                                <div className="mt-60 p-4"></div>
                                <a className={'dashboardVeryLargeLink'}
                                   href={data.occurrenceCount.url}>{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.occurrenceCount.count)}</a>
                            </div>
                            <div className={"dashboardCenter"}>
                                <div className="mt-25"></div>
                                <span className={"dashboardLargeText"}><FormattedMessage id="recordsInTotal"/></span>
                            </div>
                        </GridCard>
                    }

                    {data.datasets &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.datasets.count)}
                            header={formatMessage('dataSetsHeader')}>
                            <DashboardTable rows={data.datasets.tables[0]}/>
                            <div className={"mt-25"}>
                                <FormattedMessage id="mostRecentlyAddedDatasetIs"/>
                            </div>
                            <div className={"dashboardCenter"}>
                                <a className={'dashboardLargeLink'}
                                   href={data.datasets.mostRecent.url}>{data.datasets.mostRecent.name}</a>
                            </div>
                        </GridCard>
                    }

                    {data.basisOfRecord &&
                        <GridCard header={formatMessage('basisOfRecordHeader')}>
                            <DashboardTable rows={data.basisOfRecord.tables[0]}/>
                        </GridCard>
                    }

                    {data.collections &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.collections.count)}
                            header={formatMessage('basisOfRecordHeader')}>
                            <DashboardChart rows={data.collections.tables}/>
                        </GridCard>
                    }

                    {data.recordsByDate &&
                        <GridCard header={formatMessage('recordsByDateHeader')}>
                            <DashboardTable rows={data.recordsByDate.tables[0]}/>
                        </GridCard>
                    }

                    {data.nationalSpeciesLists &&
                        <GridCard header={formatMessage('nationalSpeciesListsHeader')}>
                            <DashboardTable rows={data.nationalSpeciesLists.tables[0]}/>
                        </GridCard>
                    }

                    {data.spatialLayers &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.spatialLayers.count)}
                            header={formatMessage('spatialLayersHeader')}>
                            <DashboardTable rows={data.spatialLayers.tables[0]}/>
                        </GridCard>
                    }

                    {data.states &&
                        <GridCard header={formatMessage('statesHeader')}>
                            <DashboardChart rows={data.states.tables}/>
                        </GridCard>
                    }

                    {data.species &&
                        <GridCard header={formatMessage('mostRecordedSpeciesHeader')}>
                            <DashboardTables tables={data.species.tables} italisize={true} id={"species"}/>
                        </GridCard>
                    }

                    {data.specimenTypes &&
                        <GridCard header={formatMessage('specimenTypesHeader')}>
                            <DashboardTables tables={data.specimenTypes.tables} id={"specimenTypes"}/>
                        </GridCard>
                    }

                    {data.bhl &&
                        <GridCard header={formatMessage('bhlHeader')}>
                            <div className={'dashboardCenter'}>
                                <a href={data.bhl.url}><img src={data.bhl.imageUrl} className="dashboardLogo"
                                                            alt={"BHL"}/></a>
                            </div>
                            <DashboardTable rows={data.bhl.tables[0]}/>
                        </GridCard>
                    }

                    {data.digivol &&
                        <GridCard header={formatMessage('digivolHeader')}>
                            <div className={'dashboardCenter'}>
                                <a href={data.digivol.url}><img src={data.digivol.imageUrl} className="dashboardLogo"
                                                                alt={"Digivol"}/></a>
                            </div>
                            <DashboardTable rows={data.digivol.tables[0]} header={data.digivol.tables[0].header}/>
                        </GridCard>
                    }

                    {data.conservation &&
                        <GridCard header={formatMessage('conservationHeader')}>
                            <DashboardTable rows={data.conservation.tables[0]}/>
                        </GridCard>
                    }

                    {data.dataProviderUid &&
                        <GridCard header={formatMessage('dataProviderHeader')}>
                            <DashboardTable rows={data.dataProviderUid.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {data.institutionUid &&
                        <GridCard header={formatMessage('institutionHeader')}>
                            <DashboardTable rows={data.institutionUid.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {data.kingdoms &&
                        <GridCard header={formatMessage('kingdomsHeader')}>
                            <DashboardKingdomTree
                                rows={data.kingdoms.tables[0]}/>
                        </GridCard>
                    }

                    {data.speciesGroup &&
                        <GridCard header={formatMessage('lifeformHeader')}>
                            <DashboardTable rows={data.speciesGroup.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {data.decade &&
                        <GridCard header={formatMessage('decadeHeader')} widthMultiplier={2}>
                            <DashboardBarChart rows={data.decade.tables}/>
                        </GridCard>
                    }

                    {data.usageStats &&
                        <GridCard header={formatMessage('usageHeader')}>
                            <DashboardTable rows={data.usageStats.tables[0]}/>
                        </GridCard>
                    }

                    {data.reasonDownloads &&
                        <GridCard header={formatMessage('downloadReasonHeader')} widthMultiplier={2}>
                            <DashboardTable rows={data.reasonDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </GridCard>
                    }

                    {data.emailDownloads &&
                        <GridCard header={formatMessage('downloadUserTypeHeader')}>
                            <DashboardTable rows={data.emailDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </GridCard>
                    }

                    {data.image &&
                        <GridCard header={formatMessage('imageHeader')}>
                            <DashboardTable rows={data.image.tables[0]}/>
                        </GridCard>
                    }
                </div>
            </div>
        )
    }

    return (!dashboardData || !messages) ? (
        <div className="d-flex justify-content-center align-items-center mt-60">
            <FontAwesomeIcon icon={faSpinner}/>
        </div>
    ) : (
        <main>
            <IntlProvider messages={messages} locale="en" defaultLocale="en" onError={() => {
            }}>
                <div>
                    <Dashboard data={dashboardData}></Dashboard>
                </div>
            </IntlProvider>
        </main>
    )
}

export default DashboardPage;
