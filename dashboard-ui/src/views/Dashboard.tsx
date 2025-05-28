/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {FormattedMessage} from "react-intl";
import "../components/dashboard/dashboard.css";
import TreeItem from "../components/dashboard/tree.jsx";
import FontAwesomeIcon from '../components/common-ui/fontAwesomeIconLite.tsx'
import {faDownload} from '@fortawesome/free-solid-svg-icons/faDownload'
import {faSpinner} from "@fortawesome/free-solid-svg-icons/faSpinner";
import {DashboardJson, Table, TableRow, TreeItemObj} from "../api/sources/model.ts";
import DashboardTable from "../components/dashboard/dashboardTable.tsx";
import {DashboardBarChart, DashboardChart} from "../components/dashboard/charts.tsx";
import DashboardTables from "../components/dashboard/dashboardTables.tsx";
import GridCard from '../components/dashboard/gridCard.tsx';

const DashboardKingdomTree = ({table}: { table: Table }) => {
    let fieldResults: TreeItemObj[] = []
    table.rows.map((row: TableRow) => {
        fieldResults.push({fq: row.url, count: Number(row.values[0]), label: row.name})
    })

    return <TreeItem level={0} list={fieldResults}/>
}

const DashboardPage = () => {
    const [dashboardData, setDashboardData] = useState<DashboardJson>();

    useEffect(() => {
        fetch(import.meta.env.VITE_APP_DASHBOARD_DATA_URL)
            .then(response => response.json())
            .then(data => {
                setDashboardData(data.data);
            });
    }, []);

    function Dashboard({dashboardData}: { dashboardData: DashboardJson }) {
        return (
            <div>
                <div className="d-flex">
                    <a className="btn btn-primary ms-auto me-5" target="_blank"
                       href={import.meta.env.VITE_APP_DASHBOARD_ZIP_URL}><FontAwesomeIcon icon={faDownload}
                                                                                          className={"me-2"}/>Download
                        as CSV</a>

                </div>
                <div className='d-flex flex-wrap justify-content-center'>
                    {dashboardData.occurrenceCount &&
                        <GridCard
                            header={<FormattedMessage id="occurrenceCountHeader" defaultMessage="Occurrence Records"/>}>
                            <div className={"dashboardCenter"}>
                                <div className="mt-60 p-4"></div>
                                <a className={'dashboardVeryLargeLink'}
                                   href={dashboardData.occurrenceCount.url}>{new Intl.NumberFormat('en').format(dashboardData.occurrenceCount.count || 0)}</a>
                            </div>
                            <div className={"dashboardCenter"}>
                                <div className="mt-25"></div>
                                <span className={"dashboardLargeText"}><FormattedMessage id="recordsInTotal"
                                                                                         defaultMessage="records in total."/></span>
                            </div>
                        </GridCard>
                    }

                    {dashboardData.datasets &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(dashboardData.datasets.count || 0)}
                            header={<FormattedMessage id="datasetsHeader" defaultMessage="Datasets"/>}>
                            <DashboardTable table={dashboardData.datasets.tables[0]}/>
                            <div className={"mt-25"}>
                                <FormattedMessage id="mostRecentlyAddedDatasetIs"
                                                  defaultMessage="Most recently added dataset is:"/>
                            </div>
                            <div className={"dashboardCenter"}>
                                <a className={'dashboardLargeLink'}
                                   href={dashboardData.datasets.mostRecent?.url}>{dashboardData.datasets.mostRecent?.name}</a>
                            </div>
                        </GridCard>
                    }

                    {dashboardData.basisOfRecord &&
                        <GridCard
                            header={<FormattedMessage id="basisOfRecordHeader" defaultMessage="Basis Of Record"/>}>
                            <DashboardTable table={dashboardData.basisOfRecord.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.collections &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(dashboardData.collections.count || 0)}
                            header={<FormattedMessage id="collections" defaultMessage="Collections"/>}>
                            <DashboardChart rows={dashboardData.collections.tables}/>
                        </GridCard>
                    }

                    {dashboardData.recordsByDate &&
                        <GridCard
                            header={<FormattedMessage id="recordsByDateHeader" defaultMessage="Records by Date"/>}>
                            <DashboardTable table={dashboardData.recordsByDate.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.nationalSpeciesLists &&
                        <GridCard header={<FormattedMessage id="nationalSpeciesListsHeader"
                                                            defaultMessage="National Species Lists"/>}>
                            <DashboardTable table={dashboardData.nationalSpeciesLists.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.spatialLayers &&
                        <GridCard
                            headerNum={new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(dashboardData.spatialLayers.count || 0)}
                            header={<FormattedMessage id="spatialLayersHeader" defaultMessage="Spatial Layers"/>}>
                            <DashboardTable table={dashboardData.spatialLayers.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.states &&
                        <GridCard header={<FormattedMessage id="statesHeader"
                                                            defaultMessage="Records by State and Territory"/>}>
                            <DashboardChart rows={dashboardData.states.tables}/>
                        </GridCard>
                    }

                    {dashboardData.species &&
                        <GridCard
                            header={<FormattedMessage id="speciesHeader" defaultMessage="Most Recorded Species"/>}>
                            <DashboardTables tables={dashboardData.species.tables} italisize={true}/>
                        </GridCard>
                    }

                    {dashboardData.specimenTypes &&
                        <GridCard header={<FormattedMessage id="specimenTypesHeader" defaultMessage="Type Specimens"/>}>
                            <DashboardTables tables={dashboardData.specimenTypes.tables}/>
                        </GridCard>
                    }

                    {dashboardData.bhl &&
                        <GridCard
                            header={<FormattedMessage id="bhlHeader" defaultMessage="Biodiversity Heritage Library"/>}>
                            <div className={'dashboardCenter'}>
                                <a href={dashboardData.bhl.url}><img src={dashboardData.bhl.imageUrl}
                                                                     className="dashboardLogo"
                                                                     alt={"BHL"}/></a>
                            </div>
                            <DashboardTable table={dashboardData.bhl.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.digivol &&
                        <GridCard
                            header={<FormattedMessage id="digivolHeader" defaultMessage="DigiVol (Volunteer Portal)"/>}>
                            <div className={'dashboardCenter'}>
                                <a href={dashboardData.digivol.url}><img src={dashboardData.digivol.imageUrl}
                                                                         className="dashboardLogo"
                                                                         alt={"Digivol"}/></a>
                            </div>
                            <DashboardTable table={dashboardData.digivol.tables[0]}
                                            header={dashboardData.digivol.tables[0].header}/>
                        </GridCard>
                    }

                    {dashboardData.conservation &&
                        <GridCard
                            header={<FormattedMessage id="conservationHeader" defaultMessage="Conservation Status"/>}>
                            <DashboardTable table={dashboardData.conservation.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.dataProviderUid &&
                        <GridCard header={<FormattedMessage id="dataProviderUidHeader"
                                                            defaultMessage="Records by Data Provider"/>}>
                            <DashboardTable table={dashboardData.dataProviderUid.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {dashboardData.institutionUid &&
                        <GridCard header={<FormattedMessage id="institutionUidHeader"
                                                            defaultMessage="Records by Institution"/>}>
                            <DashboardTable table={dashboardData.institutionUid.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {dashboardData.kingdoms &&
                        <GridCard header={<FormattedMessage id="kingdomsHeader" defaultMessage="Occurrence Tree"/>}>
                            <DashboardKingdomTree
                                table={dashboardData.kingdoms.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.speciesGroup &&
                        <GridCard
                            header={<FormattedMessage id="speciesGroupHeader" defaultMessage="Records by Lifeform"/>}>
                            <DashboardTable table={dashboardData.speciesGroup.tables[0]} header={['', '']}/>
                        </GridCard>
                    }

                    {dashboardData.decade &&
                        <GridCard header={<FormattedMessage id="decadeHeader"
                                                            defaultMessage="Records and Species by Decade"/>}>
                            <DashboardBarChart rows={dashboardData.decade.tables}/>
                        </GridCard>
                    }

                    {dashboardData.usageStats &&
                        <GridCard header={<FormattedMessage id="usageStatsHeader" defaultMessage="Usage Statistics"/>}>
                            <DashboardTable table={dashboardData.usageStats.tables[0]}/>
                        </GridCard>
                    }

                    {dashboardData.reasonDownloads &&
                        <GridCard header={<FormattedMessage id="reasonDownloadsHeader"
                                                            defaultMessage="Occurrence Downloads by Reason"/>}>
                            <DashboardTable table={dashboardData.reasonDownloads.tables[0]}
                                            header={['', 'events', 'records']}/>
                        </GridCard>
                    }

                    {dashboardData.emailDownloads &&
                        <GridCard header={<FormattedMessage id="emailDownloads"
                                                            defaultMessage="Occurrence Downloads by User Type"/>}>
                            <DashboardTable table={dashboardData.emailDownloads.tables[0]}
                                            header={['', 'events', 'records']}/>
                        </GridCard>
                    }

                    {dashboardData.image &&
                        <GridCard header={<FormattedMessage id="imageHeader" defaultMessage="Species Images"/>}>
                            <DashboardTable table={dashboardData.image.tables[0]}/>
                        </GridCard>
                    }
                </div>
            </div>
        )
    }

    return (!dashboardData) ? (
        <div className="d-flex justify-content-center align-items-center mt-60">
            <FontAwesomeIcon icon={faSpinner}/>
        </div>
    ) : (
        <div>
            <Dashboard dashboardData={dashboardData}></Dashboard>
        </div>
    )
}

export default DashboardPage;
