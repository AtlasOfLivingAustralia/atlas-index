import React, {useState, useEffect} from 'react';
import {IntlProvider, FormattedMessage} from "react-intl";
// import 'react-vis/dist/style.css';
import "../dashboard/dashboard.css";
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    Tooltip,
    Legend,
    Colors,
    CategoryScale,
    LinearScale,
    LogarithmicScale
} from 'chart.js';
import {Pie, Bar} from 'react-chartjs-2';
import TreeItem from "./tree.jsx";

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, Colors, CategoryScale, LinearScale, LogarithmicScale);

function formatNumber(number) {
    if (isNaN(number / 1.0)) {
        return number
    }
    var n = number
    var s = ''
    if (number > 1000000000) {
        n = number / 1000000000.0
        s = 'B'
    } else if (number > 1000000) {
        n = number / 1000000.0
        s = 'M'
    }

    // format n to 2 decimal places
    n = Math.round(n * 100) / 100

    return new Intl.NumberFormat('en').format(n) + s
}

const DashboardPage = () => {
    const [dashboardData, setDashboardData] = useState();
    const [messages, setMessages] = useState();

    useEffect(() => {
        fetch(import.meta.env.VITE_APP_DASHBOARD_DATA_URL)
            .then(response => response.json())
            .then(data => {
                setDashboardData(data);
            });

        fetch(import.meta.env.VITE_APP_DASHBOARD_I18N_URL)
            .then(response => response.json())
            .then(data => setMessages(data));
    }, []);

    const DashboardTable = (data) => {
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

        function clickRow(url) {
            if (url !== undefined && url != null) {
                document.location.href = url
            }
        }

        return <table className="dashboardTable">
            {headerElement}
            <tbody>{
                rows.map((row, index) => {
                    var rowClass = ''
                    if (row.url !== undefined && row.url != null) {
                        rowClass = 'dashboardRowLink'
                    }
                    return <tr className={rowClass} key={index} onClick={() => clickRow(row.url)}>
                        <td>{!italisizeName ? (<FormattedMessage id={row.name}/>) :
                            (
                                <>
                                    <i>{row.name.split(' - ')[0]}</i>
                                    {row.name.indexOf(' - ') > 0 ? ' - ' + row.name.split(' - ')[1] : ''}
                                </>
                            )
                        }</td>
                        {row.values.map((v, index) =>
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

    const DashboardKingdomTree = (data) => {
        let fieldResults = []
        data.rows.rows.map((row) => {
            fieldResults.push({fq: row.url, count: row.values[0], label: row.name})
        })

        return <TreeItem level={0} list={fieldResults} />
    }

    const DashboardTables = (data) => {

        const [state, setState] = useState({
            select: 0
        });

        function changeSelect(e) {
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
                        tables.map(table => {
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

    const DashboardChart = (dat) => {
        const table = dat.rows

        let chartData = []
        let labels = []
        let url = []

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
            onClick(event, elements) {
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
                },
            ],
        };

        return <div>
            <Pie
                data={chart}
                height={350}
                width={400}
                options={options}
            />
        </div>
    }

    const DashboardBarChart = (dat) => {
        const table = dat.rows

        let labels = []
        let url = []
        let chartData1 = []
        let chartData2 = []

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
            onClick(event, elements) {
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
                },
                {
                    label: formatMessage(table[0].header[2]),
                    data: chartData2,
                    borderWidth: 1,
                }
            ],
        };

        return <div>
            <Bar
                data={chart}
                width={455}
                height={350}
                options={options}
            />
        </div>
    }

    function formatMessage(id) {
        let msg = messages[id]
        return msg ? msg : id
    }

    function Dashboard(data) {
        data = data.data.data

        return <div>
            <div className="d-flex">
                <a className="btn border-black ms-auto" target="_blank"
                   href={import.meta.env.VITE_APP_DASHBOARD_DATA_URL}>Show raw data</a>
                <a className="btn border-black ms-2 me-5" target="_blank"
                   href={import.meta.env.VITE_APP_DASHBOARD_ZIP_URL}>Download
                    as CSV</a>
            </div>

            <div className='d-flex flex-wrap justify-content-center'>

                {data.occurrenceCount &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="occurrenceRecordHeader"/></h1>
                        </div>
                        <div className={"dashboardOccurrenceRecord dashboardPanelBody card-body"}>
                            <div className={"dashboardCenter"}>
                                <a className={'dashboardVeryLargeLink'}
                                   href={data.occurrenceCount.url}>{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.occurrenceCount.count)}</a>
                            </div>
                            <div className={"dashboardCenter"}>
                                <span className={"dashboardLargeText"}><FormattedMessage id="recordsInTotal"/></span>
                            </div>
                        </div>
                    </div>
                }

                {data.datasets &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1">{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.datasets.count)}&nbsp;
                                <FormattedMessage id="dataSetsHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.datasets.tables[0]}/>
                            <div className={'dashboardPanelSubdiv mt-3'}>
                                <div className="mb-1"><FormattedMessage id="mostRecentlyAddedDatasetIs"/></div>
                                <div className="text-center">
                                    <h4><a className={'dashboardLargeLink'}
                                           href={data.datasets.mostRecent.url}>{data.datasets.mostRecent.name}</a></h4>
                                </div>
                            </div>
                        </div>
                    </div>
                }

                {data.basisOfRecord &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="basisOfRecordHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.basisOfRecord.tables[0]}/>
                        </div>
                    </div>
                }

                {data.collections &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1">{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.collections.count)}&nbsp;
                                <FormattedMessage id="collectionsHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardChart rows={data.collections.tables}/>
                        </div>
                    </div>
                }

                {data.recordsByDate &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="recordsByDateHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.recordsByDate.tables[0]}/>
                        </div>
                    </div>
                }

                {data.nationalSpeciesLists &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="nationalSpeciesListsHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.nationalSpeciesLists.tables[0]}/>
                        </div>
                    </div>
                }

                {data.spatialLayers &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1">{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.spatialLayers.count)}&nbsp;
                                <FormattedMessage id="spatialLayersHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.spatialLayers.tables[0]}/>
                        </div>
                    </div>
                }

                {data.states &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="statesHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardChart rows={data.states.tables}/>
                        </div>
                    </div>
                }

                {data.species &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="mostRecordedSpeciesHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTables tables={data.species.tables} italisize={true} id={"species"}/>
                        </div>
                    </div>
                }

                {data.specimenTypes &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="specimenTypesHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTables tables={data.specimenTypes.tables} id={"specimenTypes"}/>
                        </div>
                    </div>
                }

                {data.bhl &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="bhlHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <div className={'dashboardCenter'}>
                                <a href={data.bhl.url}><img src={data.bhl.imageUrl} className="dashboardLogo" alt={"BHL"}/></a>
                            </div>
                            <DashboardTable rows={data.bhl.tables[0]}/>
                        </div>
                    </div>
                }

                {data.digivol &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="digivolHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <div className={'dashboardCenter'}>
                                <a href={data.digivol.url}><img src={data.digivol.imageUrl} className="dashboardLogo" alt={"Digivol"}/></a>
                            </div>
                            <DashboardTable rows={data.digivol.tables[0]} header={data.digivol.tables[0].header}/>
                        </div>
                    </div>
                }

                {data.conservation &&
                    <div className='dashboardPanel card'>
                    <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="conservationHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.conservation.tables[0]}/>
                        </div>
                    </div>
                }

                {data.dataProviderUid &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="dataProviderHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.dataProviderUid.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {data.institutionUid &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="institutionHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.institutionUid.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {data.kingdoms &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="kingdomsHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body ps-5"}>
                            <DashboardKingdomTree rows={data.kingdoms.tables[0]}/>
                        </div>
                    </div>
                }

                {data.speciesGroup &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="lifeformHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.speciesGroup.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {data.decade &&
                    <div className='dashboardPanel card dashboardPanel2'>
                        <h1 className="dashboardH1"><FormattedMessage id="decadeHeader"/></h1>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardBarChart rows={data.decade.tables}/>
                        </div>
                    </div>
                }

                {data.usageStats &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="usageHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.usageStats.tables[0]}/>
                        </div>
                    </div>
                }

                {data.reasonDownloads &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="downloadReasonHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.reasonDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </div>
                    </div>
                }

                {data.emailDownloads &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="downloadUserTypeHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.emailDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </div>
                    </div>
                }

                {data.image &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1 className="dashboardH1"><FormattedMessage id="imageHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.image.tables[0]}/>
                        </div>
                    </div>
                }
            </div>
        </div>
    }

    return (!dashboardData || !messages) ? (
            <div className="alert-info">Loading...</div>
        ) : (
            <main>
                <IntlProvider messages={messages} locale="en" defaultLocale="en" onError={() => {}}>
                    <div>
                        <Dashboard data={dashboardData}></Dashboard>
                    </div>
                </IntlProvider>
            </main>
    )
}

export default DashboardPage;
