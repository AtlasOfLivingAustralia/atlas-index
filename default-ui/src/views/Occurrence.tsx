import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {cacheFetchJson} from "../helpers/CacheFetch.tsx";

function Occurrence({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string,
    setQueryString?: (value: (((prevState: string) => string) | string)) => void
}) {
    const [result, setResult] = useState({});

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Occurrence', href: '/occurrence'},
        ]);

        fetchOccurrence();
    }, [queryString]);

    const fetchOccurrence = async () => {
        if (!queryString) {
            return;
        }
        let searchTerm = (queryString || '').split("&").filter((term) => term.startsWith("?id=") || term.startsWith("id="))[0] || ''
        searchTerm = searchTerm.split("=")[1]

        const indexJson = await cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrence/' + searchTerm, {
            method: 'GET'
        }, null);

        setResult(indexJson)
    }

    return (
        <>
            <pre>{result && JSON.stringify(result, null, 2)}</pre>
        </>
    );
}

export default Occurrence;
