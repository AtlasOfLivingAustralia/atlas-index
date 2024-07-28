import {useEffect, useState} from "react";

interface MapViewProps {
    result?: {}
}

function ClassificationView({result}: MapViewProps) {
    const [children, setChildren] = useState([]);
    const [hierarchy, setHierarchy] = useState([]);

    useEffect(() => {
        if (result?.guid) {
            fetch("http://localhost:8081/v1/search?q=idxtype:TAXON&fq=-acceptedConceptID:*&fq=parentGuid:\"" + encodeURIComponent(result.guid) + "\"").then(response => response.json()).then(data => {
                data.searchResults.sort((a, b) => (a.nameComplete < b.nameComplete ? -1 : (a.nameComplete > b.nameComplete ? 1 : 0)))
                setChildren(data.searchResults)
            })
        }
        if (result?.rankOrder) {
            let items = []
            for (let rank of result.rankOrder.split(',')) {
                items = [{rank: rank, name: result['rk_' + rank], guid: result['rkid_' + rank]}, ...items]
            }
            items.push({rank: result.rank, name: result.name, guid: result.guid})
            setHierarchy(items)
        }
    }, [result]);


    function capitalize(rank) {
        // capitalize first letter
        return rank.charAt(0).toUpperCase() + rank.slice(1);
    }

    return <>
        <div className="classificationView">
            {hierarchy && hierarchy.map((item, idx) =>
                idx < hierarchy.length - 1 ?
                    <div key={idx} className={"speciesRow" + (idx == hierarchy.length - 1 ? ' speciesLast' : '')}
                         style={{marginLeft: (idx * 20) + "px"}}>
                        <div className="speciesRank float-start">{capitalize(item.rank)}</div>
                        <div className="speciesClassificationLink float-start">{item.name}</div>
                    </div>
                    :
                    <div key={idx} className={"speciesRow" + (idx == hierarchy.length - 1 ? ' speciesLast' : '')}
                         style={{marginLeft: (idx * 20) + "px"}}>
                        <div className="speciesRank">{capitalize(item.rank)}</div>
                        <div className="speciesClassificationLink">{item.name}</div>
                    </div>
            )}

            {children && children.map((child, idx) =>
                <div key={idx} className="d-flex speciesRow" style={{marginLeft: (hierarchy.length * 20) + "px"}}>
                    <div className="speciesRank">{capitalize(child.rank)}</div>
                    <div className="speciesClassificationLink">{child.nameComplete}</div>
                </div>
            )}

            <div className="classificationInfo">
                <div className="classificationAbout">
                    <span className="bi bi-info-circle-fill"></span>
                    About classification
                </div>
                <div className="classificationInfoText">
                    Classification of organisms allows us to group them and imply how they are related to each other.
                    This
                    includes a hierarchy of ranks e.g. kingdom, phylum etc. for more information see An introduction to
                    taxonomy
                </div>
            </div>
        </div>


    </>
}

export default ClassificationView;
