/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Table, TableRow} from "../../api/sources/model.ts";
import {FormattedMessage} from "react-intl";
import {formatNumber} from "../util/FormatNumber.tsx";
import React from "react";

type DashboardTableProps = {
    table: Table;
    header?: string[];
    italisize?: boolean;
};

const DashboardTable = ({table, header, italisize = false}: DashboardTableProps) => {
    let rows = table.rows || [];
    let italisizeName = (italisize !== undefined) ? italisize : false
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
            rows.map((row: TableRow, index: number) => {
                var rowClass = ''
                if (row.url !== undefined && row.url != null) {
                    rowClass = 'dashboardRowLink'
                }
                return <tr className={rowClass} key={index} onClick={() => row.url && clickRow(row.url)}>
                    <td>{!italisizeName ? (row.name && <FormattedMessage id={row.name}/>) :
                        (
                            <>
                                <i>{row.name.split(' - ')[0]}</i>
                                {row.name.indexOf(' - ') > 0 ? ' - ' + row.name.split(' - ')[1] : ''}
                            </>
                        )
                    }</td>
                    {row.values.map((v: string | number, index: number) =>
                        (header === undefined || header === null || index < header.length - 1) ?
                            <td key={index}>{formatNumber(v)}</td>
                            :
                            <React.Fragment key={index}></React.Fragment>
                    )}
                </tr>
            })
        }</tbody>
    </table>
};

export default DashboardTable;
