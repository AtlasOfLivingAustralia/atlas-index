import {useState, useEffect} from 'react';
import {IntlProvider, FormattedMessage} from "react-intl";
import {
    RadialChart,
    VerticalBarSeries,
    XYPlot,
    DiscreteColorLegend,
    XAxis,
    YAxis,
    HorizontalGridLines
} from "react-vis";
import 'react-vis/dist/style.css';
import "../dashboard/dashboard.css";

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
        if (header != undefined) {
            if (header[2] == '') {
                header[2] = ' '
            }
            headerElement = <thead>
            <tr>
                <th>{header[0]}</th>
                <th className="text-end">{header[1]}</th>
                <th className="text-end ps-1">{header[2]}</th>
            </tr>
            </thead>
        }

        function clickRow(url) {
            if (url != undefined) {
                document.location.href = url
            }
        }

        return <table className="dashboardTable">
            {headerElement}
            <tbody>{
                rows.map((row, index) => {
                    var rowClass = ''
                    if (row.url != undefined) {
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
                            (header === undefined || index < header.length - 1) ?
                                <td key={index}>{formatNumber(v)}</td>
                                :
                                <></>
                        )}
                    </tr>
                })
            }</tbody>
        </table>
    }

    const DashboardTables = (data) => {

        const [state, setState] = useState({
            select: 0
        });

        function changeSelect(e, id) {
            let newState = {
                select: e.target.selectedIndex
            }

            setState(newState)
        }

        var tables = data.tables

        return <>
            <div className={"dashboardSelectWrapper"}>
                <select onChange={(e) => changeSelect(e, data.id)}>
                    {
                        tables.map(table => {
                            return <option value={table.name} key={table.name}><FormattedMessage
                                id={table.name ? table.name : " "} defaultMessage={table.name}/>
                            </option>
                        })
                    }
                </select>
            </div>

            <DashboardTable rows={tables[state.select]} italisize={data.italisize}/>
        </>

    }

    const DashboardChart = (data) => {
        const chart = data.rows
        const urls = data.urls

        let chartData = []
        let labels = []
        var idx = 0
        chart.map(row => {
            if (idx > 0) {
                chartData.push({
                    angle: row[1],
                    subLabel: formatNumber(row[1]),
                    label: row[0],
                    url: urls[idx - 1]
                })
                labels.push(row[0])
            }
            idx++
        })

        function openItem(item) {
            document.location.href = item.url
        }

        return <div>
            <div style={{float: "left"}}>
                <RadialChart
                    data={chartData}
                    width={455}
                    height={400}
                    showLabels={true}
                    labelsRadiusMultiplier={0.9}
                    labelsStyle={{fill: "white"}}
                    onValueClick={openItem}
                />
            </div>
        </div>
    }

    const DashboardBarChart = (data) => {
        const chart = data.rows
        const urls = data.urls

        let chartDataRecords = []
        let chartDataSpecies = []
        var idx = 0
        chart.map(row => {
            if (idx > 0) {
                chartDataRecords.push({
                    x: row[0],
                    y: row[1],
                    url: urls[idx - 1]
                })
                chartDataSpecies.push({
                    x: row[0],
                    y: row[2],
                    url: urls[idx - 1]
                })
            }
            idx++
        })

        function openItem(item) {
            document.location.href = item.url
        }

        return <div>
            <div>
                <XYPlot
                    xType="ordinal"
                    margin={{left: 75, bottom: 70}}
                    width={455}
                    height={400}>
                    <DiscreteColorLegend
                        style={{position: 'absolute', left: '120px', top: '10px'}}
                        orientation="horizontal"
                        items={[
                            // {
                            //     title: 'Species',
                            //     color: '#FF0000'
                            // },
                            {
                                title: 'Records',
                                color: '#0000FF'
                            }
                        ]}
                    />
                    <XAxis
                        tickLabelAngle={-45}
                    />
                    <YAxis/>
                    <HorizontalGridLines/>

                    <VerticalBarSeries
                        data={chartDataRecords}
                        onValueClick={openItem}
                        color={"blue"}
                    />
                    {/*<VerticalBarSeries*/}
                    {/*    data={chartDataSpecies}*/}
                    {/*    onValueClick={openItem}*/}
                    {/*    color={"red"}*/}
                    {/*/>*/}
                </XYPlot>
            </div>
        </div>
    }

    const DashboardOccurrenceTree = (url, initialData) => {
        return <div>{url} {initialData}</div>
    }

    function Dashboard(data) {
        data = data.data.data

        return <div>
            <div className="d-flex">
                <a className="btn border-black ms-auto" target="_blank"
                   href={import.meta.env.VITE_APP_DASHBOARD_DATA_URL}>Show raw data</a>
                <a className="btn border-black ms-2 me-5" target="_blank" href={import.meta.env.VITE_APP_DASHBOARD_ZIP_URL}>Download
                    as CSV</a>
            </div>

            <div className='d-flex flex-wrap justify-content-center'>

                {data.occurrenceCount &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="occurrenceRecordHeader"/></h1></div>
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
                                <FormattedMessage id="dataSetsHeader"/></h1></div>
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
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="basisOfRecordHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.basisOfRecord.tables[0]}/>
                        </div>
                    </div>
                }

                {/*{data.collections &&*/}
                {/*    <div className='dashboardPanel card'>*/}
                {/*        <h1 className="dashboardH1">{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.collections.count)}&nbsp;*/}
                {/*            <FormattedMessage id="collectionsHeader"/></h1>*/}
                {/*        /!*<FormattedMessage id="collectionsInstruction"/>*!/*/}
                {/*        <div className={"dashboardPanelBody card-body"}>*/}
                {/*            <DashboardChart rows={data.collections.chart} urls={data.collections.urls}/>*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*}*/}

                {data.recordsByDate &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="recordsByDateHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.recordsByDate.tables[0]}/>
                        </div>
                    </div>
                }

                {data.nationalSpeciesLists &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="nationalSpeciesListsHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.nationalSpeciesLists.tables[0]}/>
                        </div>
                    </div>
                }

                {data.spatialLayers &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}>
                            <h1
                                className="dashboardH1">{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.spatialLayers.count)}&nbsp;
                                <FormattedMessage id="spatialLayersHeader"/></h1>
                        </div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.spatialLayers.tables[0]}/>
                        </div>
                    </div>
                }

                {/*{data.states &&*/}
                {/*    <div className='dashboardPanel card'>*/}
                {/*        <h1 className="dashboardH1"><FormattedMessage id="statesHeader"/></h1>*/}
                {/*        /!*<FormattedMessage id="statesInstruction"/>*!/*/}
                {/*        <div className={"dashboardPanelBody card-body"}>*/}
                {/*            <DashboardChart rows={data.states.chart} urls={data.states.urls}/>*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*}*/}

                {data.species &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="mostRecordedSpeciesHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTables tables={data.species.tables} italisize={true} id={"species"}/>
                        </div>
                    </div>
                }

                {data.specimenTypes &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="specimenTypesHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTables tables={data.specimenTypes.tables} id={"specimenTypes"}/>
                        </div>
                    </div>
                }

                {/*<div className='dashboardPanel card'>*/}
                {/*    <h1 className="dashboardH1"><FormattedMessage id="barcodeOfLifeHeader"/></h1>*/}
                {/*    <div className={'dashboardCenter'}>*/}
                {/*        <a href={data.barcodeOfLife.url}><img src={data.barcodeOfLife.imageUrl}/></a>*/}
                {/*    </div>*/}
                {/*    <DashboardTable rows={data.barcodeOfLife.table} />*/}
                {/*</div>*/}

                {data.bhl &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="bhlHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <div className={'dashboardCenter'}>
                                <a href={data.bhl.url}><img src={data.bhl.imageUrl}/></a>
                            </div>
                            <DashboardTable rows={data.bhl.tables[0]}/>
                        </div>
                    </div>
                }

                {data.digivol &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="digivolHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.digivol.tables[0]}/>
                        </div>
                    </div>
                }

                {data.conservation &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="conservationHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.conservation.tables[0]}/>
                        </div>
                    </div>
                }

                {data.dataProviderUid &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="dataProviderHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.dataProviderUid.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {data.institutionUid &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="institutionHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.institutionUid.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {/*<div className='dashboardPanel card'>*/}
                {/*    <h1 className="dashboardH1"><FormattedMessage id="occurrenceTreeHeader"/></h1>*/}
                {/*    <DashboardOccurrenceTree url={data.occurrenceTree.url} initialData={data.occurrenceTree.data}/>*/}
                {/*</div>*/}

                {data.speciesGroup &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="lifeformHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.speciesGroup.tables[0]} header={['', '']}/>
                        </div>
                    </div>
                }

                {/*{data.decade &&*/}
                {/*    <div className='dashboardPanel card'>*/}
                {/*        <h1 className="dashboardH1"><FormattedMessage id="decadeHeader"/></h1>*/}
                {/*        <div className={"dashboardPanelBody card-body"}>*/}
                {/*            <DashboardBarChart rows={data.decade.chart} urls={data.decade.urls}/>*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*}*/}

                {data.usageStats &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="usageHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.usageStats.tables[0]}/>
                        </div>
                    </div>
                }

                {data.reasonDownloads &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="downloadReasonHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.reasonDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </div>
                    </div>
                }

                {data.emailDownloads &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="downloadUserTypeHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.emailDownloads.tables[0]} header={['', 'events', 'records']}/>
                        </div>
                    </div>
                }

                {data.image &&
                    <div className='dashboardPanel card'>
                        <div className={'dashboardPanelHeader card-header'}><h1 className="dashboardH1"><FormattedMessage
                            id="imageHeader"/></h1></div>
                        <div className={"dashboardPanelBody card-body"}>
                            <DashboardTable rows={data.image.tables[0]}/>
                        </div>
                    </div>
                }
            </div>
        </div>
    }

    if (!dashboardData || !messages) {
        return <div className="alert-info">Loading...</div>;
    } else {
        return (
            <main>
                <IntlProvider messages={messages} locale="en" defaultLocale="en" onError={(e) => {
                }}>
                    <div>
                        <Dashboard data={dashboardData}></Dashboard>
                    </div>
                </IntlProvider>
            </main>
        )
    }
}

export default DashboardPage;
