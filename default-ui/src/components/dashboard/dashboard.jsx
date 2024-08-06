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
import { Box, Button, Card, Center, Container, Flex, Grid, Group, Space, Text, rem } from '@mantine/core';

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, Colors, CategoryScale, LinearScale, LogarithmicScale);

const DASHBOARD_DATA_URL = import.meta.env.VITE_APP_DASHBOARD_DATA_URL;

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
        fetch(DASHBOARD_DATA_URL)
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

    const GridCard = (props) => {
        const header = props.header;
        const headerNum = props.headerNum;
        const body = props.children;
        return (
            <Grid.Col span={{ base: 12, xs: 4 }} style={{ height: rem(440) }}>
                <Card withBorder shadow="sm" radius="md" style={{ height: '100%'}}>
                    <Card.Section withBorder inheritPadding py="xs">
                        <Group justify="space-between">
                            <Text size="md" fw={500}>{headerNum} {header}</Text>
                        </Group>
                    </Card.Section>
                    <Card.Section inheritPadding py="xs" style={{  minHeight: rem(350), overflow: 'auto'  }} >
                        <Text span size="sm">{body}</Text>
                    </Card.Section>
                </Card>
            </Grid.Col>
        )
    }

    function Dashboard(data) {
        data = data.data.data

        return (
        <>
            <>
                <Flex justify="flex-end" gap="sm">
                    <Button compnent="a" target="_blank"
                    href={DASHBOARD_DATA_URL}>Show raw data</Button>
                    <Button compnent="a" target="_blank"
                    href={import.meta.env.VITE_APP_DASHBOARD_ZIP_URL}>Download
                        as CSV</Button>
                </Flex>
            </>
            <Space h="lg"/>
            {/* <div className='d-flex flex-wrap justify-content-center'> */}
            {/* <Container size="lg"> */}
            <Grid align="stretch">
                {data.occurrenceCount &&
                    <GridCard header={formatMessage('occurrenceRecordHeader')}>
                        <Space h="xl"/>
                        <Space h="xl"/>
                        <Box align="center">
                            <a className={'dashboardVeryLargeLink'}
                                href={data.occurrenceCount.url}>{new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.occurrenceCount.count)}</a>
                            <div><FormattedMessage id="recordsInTotal"/></div>
                        </Box>
                    </GridCard>
                }

                {data.datasets &&
                    <GridCard headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.datasets.count)} header={formatMessage('dataSetsHeader')}>
                        <DashboardTable rows={data.datasets.tables[0]}/>
                            <Text size="sm">
                                <FormattedMessage id="mostRecentlyAddedDatasetIs"/>
                            </Text>
                            <Text size="sm" pt="sm">
                                <a className={'dashboardLargeLink'}
                                    href={data.datasets.mostRecent.url}>{data.datasets.mostRecent.name}</a>
                            </Text>
                    </GridCard>
                }

                {data.basisOfRecord &&
                    <GridCard header={formatMessage('basisOfRecordHeader')}>
                        <DashboardTable rows={data.basisOfRecord.tables[0]}/>
                    </GridCard>
                }

                {data.collections &&
                    <GridCard headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.collections.count)} header={formatMessage('basisOfRecordHeader')}>
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
                    <GridCard headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(data.spatialLayers.count)} header={formatMessage('spatialLayersHeader')}>
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
                            <a href={data.bhl.url}><img src={data.bhl.imageUrl} className="dashboardLogo" alt={"BHL"}/></a>
                        </div>
                        <DashboardTable rows={data.bhl.tables[0]}/>
                    </GridCard>
                }

                {data.digivol &&
                    <GridCard header={formatMessage('digivolHeader')}>
                        <div className={'dashboardCenter'}>
                            <a href={data.digivol.url}><img src={data.digivol.imageUrl} className="dashboardLogo" alt={"Digivol"}/></a>
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
                        <DashboardKingdomTree rows={data.kingdoms.tables[0]}/>
                    </GridCard>
                }

                {data.speciesGroup &&
                    <GridCard header={formatMessage('lifeformHeader')}>
                        <DashboardTable rows={data.speciesGroup.tables[0]} header={['', '']}/>
                    </GridCard>
                }

                {data.decade &&
                    <GridCard header={formatMessage('decadeHeader')}>
                        <DashboardBarChart rows={data.decade.tables}/>
                    </GridCard>
                }

                {data.usageStats &&
                    <GridCard header={formatMessage('usageHeader')}>
                        <DashboardTable rows={data.usageStats.tables[0]}/>
                    </GridCard>
                }

                {data.reasonDownloads &&
                    <GridCard header={formatMessage('downloadReasonHeader')}>
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
            </Grid>
        </>
    )}

    return (!dashboardData || !messages) ? (
            <div className="alert-info">Loading...</div>
        ) : (
            // <Container size="xl">
                <IntlProvider messages={messages} locale="en" defaultLocale="en" onError={() => {}}>
                    <Dashboard data={dashboardData}/>
                </IntlProvider>
            // </Container>
    )
}

export default DashboardPage;
