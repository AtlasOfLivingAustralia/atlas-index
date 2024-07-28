interface MapViewProps {
    result?: {},
    resultV1?: {}
}

function StatusView({result, resultV1}: MapViewProps) {

    // TODO: This should be fetched from a static source
    const iucnClasses = [
        {
            "code": "EX",
            "name": "Extinct",
            "status": ["Extinct"],
            "bg": "#212121",
            "fg": "#FFC557"
        },
        {
            "code": "EW",
            "name": "Extinct in the Wild",
            "status": ["Extinct in the Wild"],
            "bg": "#212121",
            "fg": "#FFFFFF"
        },
        {
            "code": "CR",
            "name": "Critically Endangered",
            "status": ["Critically Endangered"],
            "bg": "#921D11",
            "fg": "#FFFFFF"
        },
        {
            "code": "EN",
            "name": "Endangered",
            "status": ["Endangered"],
            "bg": "#F26649",
            "fg": "#212121"
        },
        {
            "code": "VU",
            "name": "Vulnerable",
            "status": ["Vulnerable"],
            "bg": "#FFC557",
            "fg": "#212121"
        },
        {
            "code": "NT",
            "name": "Near Threatened",
            "status": ["Near Threatened", "Rare"],
            "bg": "#38613D",
            "fg": "#FFFFFF"
        },
        {
            "code": "LC",
            "name": "Least Concern",
            "status": ["Least Concern"],
            "bg": "#B7CD96",
            "fg": "#212121"
        }
    ]

    return <>
        <div className="statusView">

            <div className="namesSectionHeader">Native / Introduced</div>
            <div className="namesInfo">
                <div className="classificationAbout">
                    <span className="bi bi-info-circle-fill"></span>
                    About native / introduced
                </div>
                <div className="classificationInfoText">
                    This indicates if a species is regarded as introduced to Australia, a state, or territory.
                    This can also include Australian native species which have been introduced in areas beyond
                    their natural range, e.g a species native to NSW introduced to WA.&nbsp;
                    <span className="namesLink">Find out more</span>
                </div>
            </div>
            <div className="namesRowHeader d-flex">
                <div className="statusRowHeaderLabelLeft">Place</div>
                <div className="statusRowHeaderLabelMiddle">Status</div>
                <div className="statusRowHeaderLabelRight">Source</div>
            </div>
            {resultV1?.conservationStatuses && Object.keys(resultV1.conservationStatuses).map((key, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="statusRowName">{resultV1.conservationStatuses[key].dr}</div>
                    <div className="statusRowSource">{resultV1.conservationStatuses[key].status}</div>
                    <div className="statusRowStatus">{resultV1.conservationStatuses[key].dr}</div>
                </div>
            )}

            <div className="namesSectionFoot"></div>
            <div className="namesSectionHeader">Conservation status</div>
            <div className="namesRowHeader d-flex">
                <div className="statusRowHeaderLabelLeft">Level</div>
                <div className="statusRowHeaderLabelMiddle">Status</div>
                <div className="statusRowHeaderLabelRight">ICUN Equivalent Class</div>
            </div>
            {resultV1?.conservationStatuses && Object.keys(resultV1.conservationStatuses).map((key, idx) =>
                <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                    <div className="statusRowName">{resultV1.conservationStatuses[key].dr}</div>
                    <div className="statusRowSource">{resultV1.conservationStatuses[key].status}</div>
                    <div className="statusRowStatus">
                        {iucnClasses && iucnClasses.map((item, idx) =>
                            item.status.includes(resultV1.conservationStatuses[key].status) &&
                                <div key={idx} className="iucnRow col-4">
                                    <div className="iucnIcon" style={{backgroundColor: item.bg, color: item.fg}}>{item.code}</div>
                                </div>
                        )}
                    </div>
                </div>
            )}
            <div className="namesInfo">
                <div className="classificationAbout">
                    <span className="bi bi-info-circle-fill"></span>
                    About the IUCN Equivalent Classes
                </div>
                <div className="classificationInfoText">
                    Atlas of Living Australia have interpreted state and territory status classes to align to the
                    equivalent
                    International Union for Conservation of Nature (IUCN) Classes.
                    &nbsp;
                    <span className="namesLink">Find out more</span>
                </div>
            </div>

            <div className="iucnSection row">
                {iucnClasses && iucnClasses.map((item, idx) =>
                    <div key={idx} className="iucnRow col-4 d-flex">
                        <div className="iucnIcon" style={{backgroundColor: item.bg, color: item.fg}}>{item.code}</div>
                        <div className="iucnLabel">{item.name}</div>
                    </div>
                )}
            </div>

        </div>
    </>
}

export default StatusView;
