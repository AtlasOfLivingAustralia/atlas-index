import {QualityCategory} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import {cacheFetchJson} from "../../helpers/CacheFetch.tsx";

interface DataQualityExcludedProps {
}

interface DataQualityExcludedProps {
    queryString: string | undefined,
    category: QualityCategory,
    addParams: (fqs: string[], removeFqs: string[]) => void
}

function DataQualityExcluded({queryString, category, addParams}: DataQualityExcludedProps) {

    const [count, setCount] = useState<number | undefined>();

    useEffect(() => {
        updateCount();
    }, [queryString]);

    function updateCount() {
        if (queryString && category) {
            let thisQueryString = queryString + "&disableAllQualityFilters=true&fq=" + category.inverseFilter;

            cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search?" + thisQueryString, {}, null)
                .then(data => setCount(data.totalRecords));
        }
    }

    function showOnly() {
        addParams(["disableAllQualityFilters=true", "fq=" + category.inverseFilter], []);
    }

    return <>
        {count !== undefined ?
            <div onClick={() => showOnly()} className={count > 0 ? "dqLabel" : ''}>({count} records excluded)</div>
            :
            <div className="spinner-border" role="status">
                <span className="visually-hidden">...</span>
            </div>
        }
    </>
}

export default DataQualityExcluded;
