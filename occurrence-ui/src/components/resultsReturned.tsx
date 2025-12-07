/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";

interface ResultsReturnedProps {
    results?: {},
    queryString?: string
}

function ResultsReturned({results, queryString}: ResultsReturnedProps) {

    const [count, setCount] = useState<number | undefined>();

    useEffect(() => {
        setCount(undefined);
        updateCount();
    }, [queryString, results]);

    function updateCount() {
        if (queryString) {
            let thisQueryString = queryString + "&disableAllQualityFilters=true";

            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search" + thisQueryString, {})
                  .then(response => response.json())
                  .then(data => setCount(data.totalRecords))
                  .catch(e => console.error(e));
        }
    }

    return <>
        <span id="returnedText">
            {/*@ts-ignore*/}
            <strong>{results && new Intl.NumberFormat().format(results.totalRecords)}</strong>
            <span>&nbsp;records returned</span>
            {count && <>
                <span>&nbsp;of&nbsp;</span>
                {/*@ts-ignore*/}
                <strong>{new Intl.NumberFormat().format(count)}</strong>
            </>}
            <span>&nbsp;for&nbsp;</span>
            {/*@ts-ignore*/}
            <strong dangerouslySetInnerHTML={{__html: results && results.queryTitle}}></strong>
        </span>
    </>
}

export default ResultsReturned;
