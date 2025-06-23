import {useEffect, useState} from "react";
import {cacheFetchJson} from "../../helpers/CacheFetch.tsx";

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

            cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search?" + thisQueryString, {}, null)
                .then(data => setCount(data.totalRecords)).catch(e => console.error(e));
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

