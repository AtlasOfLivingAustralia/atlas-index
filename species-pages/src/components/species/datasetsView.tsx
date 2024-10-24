import {useCallback, useEffect, useState} from "react";
import { Anchor, Alert, Skeleton, Table, Text } from "@mantine/core";
import { FlagIcon } from '@atlasoflivingaustralia/ala-mantine';

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

interface Dataset {
    name: string;
    dataResourceUid: string;
    licence: string;
    records: number;
}

function DatasetsView({result}: MapViewProps) {

    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        setLoading(true);
        setErrorMessage('');
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search?q=lsid:\"" + encodeURIComponent(result.guid) + "\"&pageSize=0&facet=true&facets=dataResourceUid", {
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                let newDatasets = [];
                let drs = [];
                if (!data || !data.facetResults || data.facetResults.length === 0) {
                    setLoading(false)
                    return;
                }

                for (let item of data.facetResults[0].fieldResult) {
                    if (item.label) {
                        let dr = item.fq.replace("dataResourceUid:", "").replaceAll('"', '');
                        newDatasets.push({
                            name: item.label,
                            dataResourceUid: dr,
                            records: item.count,
                            licence: ""
                        });
                        drs.push("id:" + dr)
                    }
                }

                // get licences
                fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=idxtype:DATARESOURCE&fq=" + encodeURIComponent(drs.join(" OR ")) + "&fl=id,license&pageSize=1000", {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                    .then(response => response.json())
                    .then(data => {
                        for (let item of data.searchResults) {
                            for (let dataset of newDatasets) {
                                if (dataset.dataResourceUid == item.id) {
                                    dataset.licence = item.license;
                                }
                            }
                        }
                        setDatasets(newDatasets);
                    })
                    .catch(error => {
                        setErrorMessage('Failed to fetch licenses - ' + error);
                    })
                    .finally(() => {
                        setLoading(false);
                    });
            })
            .catch(error => {
                setErrorMessage('Failed to fetch datasets - ' + error);
                setLoading(false);
            })
    }, [result]);

    const populateTableData = useCallback(() => {
        return {
            head: ['Dataset', 'Licence', 'Records'],
            body: datasets.map((item) => [
                <Anchor target="_blank" href={import.meta.env.VITE_COLLECTIONS_URL + "/public/show/" + item.dataResourceUid}>
                    {item.name}
                </Anchor>,
                item.licence,
                <Anchor target="_blank" href={import.meta.env.VITE_APP_BIOCACHE_UI_URL + "/occurrences/search?q=lsid:\"" + result?.guid
                    + "\"&fq=dataResourceUid:" + item.dataResourceUid}>
                    {item.records.toLocaleString()}
                </Anchor>
            ]),
        };
    }, [datasets]);

    return <>
        { loading &&
            <Skeleton height={40} width="100%" radius="md" />
        }
        { errorMessage &&
            <Alert icon={<FlagIcon />}>
                <b>Error loading datasets</b>
                <p>Report this error by clicking on the <b>Need Help?</b> button on the right edge of the screen.</p>
                <code>{errorMessage}</code>
            </Alert>
        }
        { datasets.length > 0 &&
            <Table
                striped="even"
                data={populateTableData()}
            />
        }
        { !loading && !errorMessage && datasets.length == 0 &&
            <Text>No datasets found</Text>
        }
    </>
}

export default DatasetsView;
