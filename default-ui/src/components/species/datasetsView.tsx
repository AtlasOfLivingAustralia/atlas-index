import {useEffect, useState} from "react";

interface MapViewProps {
    result?: {},
    resultV1?: {}
}

function DatasetsView({result, resultV1}: MapViewProps) {

    const [datasets, setDatasets] = useState([]);

    // TODO: This should be fetched from a static source
    // const datasets = [
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

        fetch("https://biocache.ala.org.au/ws/occurrences/search?q=lsid:\"" + encodeURIComponent(result.guid) + "\"&pageSize=0&facet=true&facets=dataResourceUid", {
            // headers: {
            //     'Content-Type': 'application/json'
            // }
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
                            records: item.count
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
            })
    }, [result]);

    return <>
        <div className="datasetsView">
            <div className="speciesMapAbout">
                <span className="bi bi-info-circle-fill"></span>
                About datasets
            </div>
            <div className="speciesMapText">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec interdum sodales nunc, luctus libero
                dictum vel. Donec placerat luctus eros, in iaculis ipsum pharetra volutpat. Sellus dictum nisi in
                justo posuere, sit amet viverra lectus rutrum.
            </div>

            <div className="namesRowHeader datasetTable d-flex">
                <div className="speciesTableHeaderItem datasetName">Dataset</div>
                <div className="speciesTableHeaderItem datasetLicence">Licence</div>
                <div className="speciesTableHeaderItem datasetRecords">Records</div>
            </div>
            {datasets.map((item, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="speciesTableItem datasetName">
                        <a target="_blank" href={"https://collections.ala.org.au/public/show/" + item.dataResourceUid}>
                            {item.name}
                        </a>
                    </div>
                    <div className="speciesTableItem datasetLicence">{item.licence}</div>
                    <div className="speciesTableItem datasetRecords">
                        <a target="_blank" href={"https://biocache.ala.org.au/occurrences/search?q=lsid:\"" + result.guid + "\"&fq=dataResourceUid:" + item.dataResourceUid}>
                            {item.records.toLocaleString()}
                        </a>
                    </div>
                </div>
            )}
        </div>
    </>
}

export default DatasetsView;
