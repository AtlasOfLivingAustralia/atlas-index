import {useEffect, useState} from "react";
import Bibliography from "../citation/bibliography.tsx";

interface MapViewProps {
    result?: {},
    resultV1?: {}
}

function ResourcesView({result, resultV1}: MapViewProps) {

    // const [bhl, setBhl] = useState([]);
    const bhl = [
            {
                "BHLType": "Part",
                "FoundIn": "Metadata",
                "Volume": "12",
                "ExternalUrl": "http://www.biodiversitylibrary.org/content/part/JAMCA/JAMCA_V12_N3_P429-436.pdf",
                "PartUrl": "https://www.biodiversitylibrary.org/part/126846",
                "PartID": "126846",
                "Genre": "Article",
                "Title": "Eastern equine encephalitis transmission to emus (Dromaius novaehollandiae) in Volusia County, Florida: 1992 through 1994.",
                "ContainerTitle": "Journal of the American Mosquito Control Association",
                "Issue": "3 Pt 1",
                "Date": "1996",
                "PageRange": "429-436"
            },
            {
                "BHLType": "Part",
                "FoundIn": "Metadata",
                "Volume": "120",
                "Authors": [
                    {
                        "Name": "Eberhard, Rolan"
                    }
                ],
                "PartUrl": "https://www.biodiversitylibrary.org/part/304403",
                "PartID": "304403",
                "Genre": "Article",
                "Title": "Tasmanian emu (Dromaius novaehollandiae diemenensis ) at the Queen Victoria Museum and Art Gallery, Launceston: description, provenance, age",
                "ContainerTitle": "Record of the Queen Victoria Museum and Art Gallery",
                "PageRange": "1--46"
            },
            {
                "BHLType": "Part",
                "FoundIn": "Metadata",
                "Volume": "28",
                "Authors": [
                    {
                        "Name": "Hermes, Michael"
                    }
                ],
                "PartUrl": "https://www.biodiversitylibrary.org/part/374200",
                "PartID": "374200",
                "Genre": "Article",
                "Title": "The restricted distribution of the Emu (Dromaius novaehollandiae) calls for a more nuanced understanding of traditional Aboriginal environmental management",
                "PageRange": "2--6"
            },
            {
                "BHLType": "Part",
                "FoundIn": "Metadata",
                "Volume": "124",
                "Authors": [
                    {
                        "Name": "O'callaghan, Michael G"
                    },
                    {
                        "Name": "Davies, Margaret"
                    },
                    {
                        "Name": "Andrews, Ross H"
                    }
                ],
                "PartUrl": "https://www.biodiversitylibrary.org/part/81667",
                "PartID": "81667",
                "Genre": "Article",
                "Title": "Species of Raillietina Fuhrmann, 1920 (Cestoda: Davaineidae) from the emu, Dromaius novaehollandiae",
                "ContainerTitle": "Transactions of the Royal Society of South Australia",
                "Date": "2000",
                "PageRange": "105--116"
            }
        ]

    // const bhlResources = [
    //     {
    //         text: "Eberhard, R., 'Tasmanian emu (Dromaius novaehollandiae diemenensis ) at the Queen Victoria Museum " +
    //             "and Art Gallery, Launceston: description, provenance, age', Record of the Queen Victoria Museum and " +
    //             "Art Gallery, 120"
    //     },
    //     {
    //         text: "Eberhard, R., 'Tasmanian emu (Dromaius novaehollandiae diemenensis ) at the Queen Victoria Museum " +
    //             "and Art Gallery, Launceston: description, provenance, age', Record of the Queen Victoria Museum and " +
    //             "Art Gallery, 120"
    //     }
    // ]

    useEffect(() => {
        if (!result?.name || !resultV1) {
            return;
        }

        let page = 1;
        let s = [result.name];
        if (resultV1?.synonyms) {
            resultV1.synonyms.forEach((synonym: any) => {
                s.push(synonym.nameString)
            })
        }
        let url = "https://www.biodiversitylibrary.org/api3" +
            "?op=PublicationSearch" +
            "&searchterm=" + encodeURIComponent('"' + s.join('" OR "') + '"') +
            "&searchtype=C&page=" + page + "&apikey=" + encodeURIComponent(import.meta.env.VITE_BHL_API_KEY) + "&format=json"

        // fetch(url)
        //     .then(response => response.json())
        //     .then(data => {
        //         console.log(data)
        //         if (data?.Result) {
        //             setBhl(data.Result)
        //         }
        //     })
    }, [result]);


    return <>
        <div className="resourcesView">
            <div className="namesSectionHeader">
                Literature
            </div>
            <div className="sectionSubHeader">
                Biodiversity Heritage Library
            </div>
            {bhl && bhl.map((resource, index) =>
                <div className="resourceBox" key={index}>
                    {resource.thumbnail && <div className="pull-right"><img
                        className="img-thumbnail bhl-thumbnail" src="${item.thumbnailUrl}"/></div>
                    }
                    <Bibliography resource={resource}/>
                </div>
            )}

            <div className="sectionFoot"></div>

            <div className="namesSectionHeader mt-30">
                Online resources
            </div>
            <div className="speciesMapButtons">
                <div className="speciesMapButton d-flex float-start">
                    <div>Australian Reference Genome Atlas (ARGA)</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
                <div className="speciesMapButtonSpace float-start">&nbsp;</div>
                <div className="speciesMapButton d-flex float-start">
                    <div>API</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
            </div>

            <div className="sectionFoot"></div>

            <div className="namesSectionHeader mt-30">
                Other resources
            </div>
            <div className="speciesMapButtons">
                <div className="speciesMapButton d-flex float-start">
                    <div>Australian Museum</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
                <div className="speciesMapButtonSpace float-start">&nbsp;</div>
                <div className="speciesMapButton d-flex float-start">
                    <div>Queensland Museum</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
            </div>
            <div className="speciesMapButtons mt-30">
                <div className="speciesMapButton d-flex float-start">
                    <div>Fauna of Australia Profile</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
                <div className="speciesMapButtonSpace float-start">&nbsp;</div>
                <div className="speciesMapButton d-flex float-start">
                    <div>Species Profile and Threats Database (SPRAT)</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
                <div className="speciesMapButtonSpace float-start">&nbsp;</div>
                <div className="speciesMapButton d-flex float-start">
                    <div>PestSmart Management Toolkit</div>
                    <div className="bi bi-arrow-right-short ms-auto species-red"></div>
                </div>
            </div>
        </div>
    </>
}

export default ResourcesView;
