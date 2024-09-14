import {useEffect, useState} from "react";
import { Anchor, Flex, Notification, Skeleton, Table, TableData, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";

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

    // TODO: This should be fetched from a static source
    // const datasets: Dataset[] = [
    //     {
    //         "name": "Atlas of Living Australia",
    //         "dataResourceUid" : "dr1",
    //         "licence": "CC-BY 3.0",
    //         "records": 1234
    //     },
    //     {
    //         "name": "GBIF",
    //         "dataResourceUid" : "dr2",
    //         "licence": "CC-BY 3.0",
    //         "records": 1234
    //     },
    //     {
    //         "name": "ALA1",
    //         "dataResourceUid" : "dr3",
    //         "licence": "CC-BY 3.0",
    //         "records": 1234
    //     },
    //     {
    //         "name": "ALA2",
    //         "dataResourceUid" : "dr4",
    //         "licence": "CC-BY 3.0",
    //         "records": 1234
    //     }
    // ]

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        setLoading(true);
        setErrorMessage('');
        fetch("https://biocache.ala.org.au/ws/occurrences/search?q=lsid:\"" + encodeURIComponent(result.guid) + "\"&pageSize=0&facet=true&facets=dataResourceUid", {
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                let newDatasets = [];
                let drs = [];
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
                fetch("http://localhost:8081/v2/search?q=idxtype:DATARESOURCE&fq=" + encodeURIComponent(drs.join(" OR ")) + "&fl=id,license&pageSize=1000", {
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
                        // setLoading(false);
                    });
            })
            .catch(error => {
                setErrorMessage('Failed to fetch datasets - ' + error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [result]);

    // Format the dataset table data for rendering
    const [tableData, setTableData] = useState<TableData>({});
    useEffect(() => {
        setTableData({
            head: ['Dataset', 'Licence', 'Records'],
            body: datasets.map((item) => [
                <Anchor target="_blank" href={"https://collections.ala.org.au/public/show/" + item.dataResourceUid}>
                    {item.name}
                </Anchor>,
                item.licence,
                <Anchor target="_blank" href={"https://biocache.ala.org.au/occurrences/search?q=lsid:\"" + result?.guid 
                    + "\"&fq=dataResourceUid:" + item.dataResourceUid}>
                    {item.records.toLocaleString()}
                </Anchor>
            ]),
        });
    }, [datasets]);

    return <>
        <Flex justify="flex-start" align="center" gap="xs" mb="sm">
            <IconInfoCircleFilled size={18}/>
            <Text fw="bold">About datasets</Text>
        </Flex>
        <Text mt="sm">
            Much of the content in the Atlas of Living Australia, such as occurrence records, 
            environmental data, images and the conservation status of species, comes from 
            data sets provided by collecting institutions, government departments, individual 
            collectors and community groups. 
        </Text>
        { loading && 
            <Skeleton height={800} mt="lg" width="100%" radius="md" />
        }
        { errorMessage && 
            <Notification 
                withBorder 
                mt="lg"
                onClose={() => setErrorMessage('')}
                title="Error loading datasets"
            >
                {errorMessage}
            </Notification>
        }
        { datasets.length > 0 &&
            <Table 
                striped="even" 
                data={tableData} 
                mt="lg" 
            />
        }
    </>
}

export default DatasetsView;
