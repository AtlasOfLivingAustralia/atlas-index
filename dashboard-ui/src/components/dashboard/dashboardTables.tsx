/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState} from "react";
import {FormattedMessage} from "react-intl";
import DashboardTable from "./dashboardTable.tsx";
import {Table} from "../../api/sources/model.ts";

type DashboardTablesState = {
    select: number;
};

type DashboardTablesProps = {
    tables: Table[];
    italisize?: boolean;
};

const DashboardTables = ({tables, italisize = false}: DashboardTablesProps) => {

    const [state, setState] = useState<DashboardTablesState>({
        select: 0
    });

    function changeSelect(e: React.ChangeEvent<HTMLSelectElement>) {
        let newState = {
            select: e.target.selectedIndex
        }

        setState(newState)
    }

    return <>
        <div className={"dashboardSelectWrapper"}>
            <select onChange={(e) => changeSelect(e)}>
                {
                    tables.map((table: Table) => {
                        return <option value={table.name} key={table.name}>
                            <FormattedMessage id={table.name ? table.name : " "} defaultMessage={table.name}/>
                        </option>
                    })
                }
            </select>
        </div>

        <DashboardTable table={tables[state.select]} italisize={italisize}/>
    </>

}

export default DashboardTables;
