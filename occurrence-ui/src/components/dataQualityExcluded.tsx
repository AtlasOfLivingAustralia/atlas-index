/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {FormattedMessage} from "react-intl";
import {QualityCategory} from "../api/model.tsx";
import { fetchDqCountsSequentially } from "../utils/dqCache";

interface DataQualityExcludedProps {
    queryString: string | undefined,
    category: QualityCategory,
    addParams: (fqs: string[], removeFqs: string[]) => void
}

function DataQualityExcluded({queryString, category, addParams}: DataQualityExcludedProps) {

    const [count, setCount] = useState<number | undefined>();

    useEffect(() => {
        if (!queryString || !category?.inverseFilter) return;

        fetchDqCountsSequentially(
            import.meta.env.VITE_APP_BIOCACHE_URL,
            queryString,
            [category],
            (_label, value) => setCount(value)
        );
    }, [queryString, category?.inverseFilter]);

    function showOnly() {
        addParams(["disableAllQualityFilters=true", "fq=" + category.inverseFilter], []);
    }

    return <>
        {count !== undefined ?
            <div onClick={() => showOnly()} className={count > 0 ? "dqLabel" : ''}>({count} <FormattedMessage id="quality.filters.excludeCount" defaultMessage="records excluded" />)</div>
            :
            <div className="spinner-border" role="status" style={{width: "1.5em", height: "1.5em"}}>
                <span className="visually-hidden">...</span>
            </div>
        }
    </>
}

export default DataQualityExcluded;
