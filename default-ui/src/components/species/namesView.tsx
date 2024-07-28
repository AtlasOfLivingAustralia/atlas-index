interface MapViewProps {
    result?: {},
    resultV1?: {}
}

function NamesView({result, resultV1}: MapViewProps) {

    return <>
        <div className="namesView">

            <div className="namesSectionHeader">Scientific</div>
            <div className="namesRow d-flex">
                <div className="namesRowName" dangerouslySetInnerHTML={{__html: result?.nameFormatted}}></div>
                <div className="namesRowSource">{result?.datasetName}</div>
            </div>

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Common</div>
            {resultV1?.commonNames && resultV1.commonNames.map((item, idx) =>
                item?.status !== 'traditionalKnowledge' &&
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="namesRowName">{item?.nameString}</div>
                    {item?.infoSourceURL ?
                        <a href={item?.infoSourceURL} className="namesRowSource">{item?.infoSourceName}</a>
                        :
                        <div className="namesRowSource">{item?.infoSourceName}</div>
                    }
                </div>
            )}

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Indigenous</div>
            <div className="namesInfo">
                <div className="classificationAbout">
                    <span className="bi bi-info-circle-fill"></span>
                    About indigenous names
                </div>
                <div className="classificationInfoText">
                    Classification of organisms allows us to group them and imply
                    how they are related to each other. This includes a hierarchy
                    of ranks e.g. kingdom, phylum etc. for more information see&nbsp;
                    <span className="namesLink">An introduction to taxonomy</span>.
                </div>
            </div>
            <div className="namesRow namesRowHeader d-flex">
                <div className="namesRowHeaderLabelLeft">Name</div>
                <div className="namesRowHeaderLabelRight">See language group</div>
            </div>
            {resultV1?.commonNames && resultV1.commonNames.map((item, idx) =>
                item?.status === 'traditionalKnowledge' &&
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="namesRowName">{item?.nameString}</div>
                    {item?.infoSourceURL ?
                        <a href={item?.infoSourceURL} className="namesRowSource">{item?.language}</a>
                        :
                        <div className="namesRowSource">{item?.language}</div>
                    }
                </div>
            )}

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Synonyms</div>
            {resultV1?.synonyms && resultV1.synonyms.map((item, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="namesRowName" dangerouslySetInnerHTML={{__html: item?.nameFormatted}}></div>
                    {item?.infoSourceURL ?
                        <a href={item?.infoSourceURL} className="namesRowSource">{item?.infoSourceName || item?.nameAuthority}</a>
                        :
                        <div className="namesRowSource">{item?.infoSourceName}</div>
                    }
                </div>
            )}

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Variants</div>
            {resultV1?.variants && resultV1.variants.map((item, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="namesRowName" dangerouslySetInnerHTML={{__html: item?.nameFormatted}}></div>
                    {item?.infoSourceURL ?
                        <a href={item?.infoSourceURL} className="namesRowSource">{item?.infoSourceName}</a>
                        :
                        <div className="namesRowSource">{item?.infoSourceName}</div>
                    }
                </div>
            )}

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Identifiers</div>
            {resultV1?.identifiers && resultV1.identifiers.map((item, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="namesRowName">{item?.identifier}</div>
                    {item?.infoSourceURL ?
                        <a href={item?.infoSourceURL} className="namesRowSource">{item?.infoSourceName}</a>
                        :
                        <div className="namesRowSource">{item?.infoSourceName}</div>
                    }
                </div>
            )}
        </div>
    </>
}

export default NamesView;
