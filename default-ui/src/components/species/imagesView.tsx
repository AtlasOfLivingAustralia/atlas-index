import {Children, useEffect, useState} from "react";

interface MapViewProps {
    result?: {}
}

function ImagesView({result}: MapViewProps) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [type, setType] = useState('all');
    const [sortDir, setSortDir] = useState('desc');
    const [includeOccurrences, setIncludeOccurrences] = useState(true);
    const [includeSpecimens, setIncludeSpecimens] = useState(true);
    const [occurrenceCount, setOccurrenceCount] = useState(0);

    const pageSize = 10;

    useEffect(() => {
        fetchImages()
    }, [result, page, sortDir, includeOccurrences, includeSpecimens, type]);

    function fetchImages() {
        if (!result?.guid) {
            return;
        }

        let typeFq;
        if (type === 'all') {
            typeFq = "&fq=multimedia:*"
        } else if (type === 'image') {
            typeFq = "&fq=multimedia:Image"
        } else if (type === 'video') {
            typeFq = "&fq=multimedia:Video"
        } else if (type === 'sound') {
            typeFq = "&fq=multimedia:Sound"
        }

        let specimenFq;
        if (includeSpecimens && includeOccurrences) {
            specimenFq = '&fq=(-typeStatus:*%20AND%20-basisOfRecord:PreservedSpecimen%20AND%20-identificationQualifier:"Uncertain"%20AND%20spatiallyValid:true%20AND%20-userAssertions:50001%20AND%20-userAssertions:50005)%20OR%20(basisOfRecord:PreservedSpecimen%20AND%20-typeStatus:*)'
        } else if (includeSpecimens) {
            specimenFq = '&fq=basisOfRecord:PreservedSpecimen&fq=-typeStatus:*'
        } else if (includeOccurrences) {
            specimenFq = '&fq=-typeStatus:*&fq=-basisOfRecord:PreservedSpecimen&fq=-identificationQualifier:"Uncertain"&fq=spatiallyValid:true&fq=-userAssertions:50001&fq=-userAssertions:50005'
        } else {
            setItems([]);
        }

        let mediaFilter = '&qualityProfile=ALA&fq=-(duplicateStatus:ASSOCIATED%20AND%20duplicateType:DIFFERENT_DATASET)'

        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            '&start=' + (page * pageSize) +
            '&pageSize=' + pageSize +
            '&dir=' + sortDir +
            '&sort=eventDate' +
            typeFq +
            specimenFq +
            mediaFilter)
            .then(response => response.json())
            .then(data => {
                let list = [];
                data.occurrences.map(item => {
                    if (item.images && (type === 'all' || type === 'image')) {
                        for (let id of item.images) {
                            list.push({id: id, type: 'image'});
                        }
                    }
                    if (item.videos && (type === 'all' || type === 'video')) {
                        for (let id of item.videos) {
                            list.push({id: id, type: 'video'});
                        }
                    }
                    if (item.sound && (type === 'all' || type === 'sound')) {
                        for (let id of item.sound) {
                            list.push({id: id, type: 'sound'});
                        }
                    }
                })
                if (page == 0) {
                    setItems(list);
                    setOccurrenceCount(data.totalRecords);
                } else {
                    setItems([...items, ...list]);
                }
            });
    }


    function resetView() {
        setPage(0);
        // setItems([]);
    }

    return <>
        <div className="speciesImagesView">
            <div className="d-flex">
                <div className={"btn " + (type === 'all' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                    onClick={() => {resetView();setType('all')}}>View all</div>
                <div className={"btn  " + (type === 'image'? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                     onClick={() => {resetView();setType('image')}}>Images</div>
                <div className={"btn  " + (type === 'sound' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                     onClick={() => {resetView();setType('sound')}}>Sounds</div>
                <div className={"btn  " + (type === 'video' ? 'speciesImageBtnSelected' : 'speciesImageBtn')}
                     onClick={() => {resetView();setType('video')}}>Videos</div>
            </div>

            <div className="speciesImagesCount">
            Showing {occurrenceCount > 0 ? (page+1)*pageSize : 0} of {occurrenceCount} results
            </div>

            <div className="d-flex">
                <div className="speciesImagesBlock">
                    {items && items.map((item, idx) =>
                        <>
                            {item.type === 'image' && <img className="speciesImageBlockImg" key={idx} src={"https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=" + item.id}></img>}
                            {item.type === 'sound' && <audio key={idx} controls></audio>}
                            {item.type === 'video' && <video key={idx} controls></video>}
                        </>
                    )}
                </div>
                <div className="speciesImagesControl">
                    <div className="speciesRefineView"><span className="bi bi-sliders"></span>Refine results</div>
                    <div className="speciesMapControlItem speciesMapControlItemHr">
                        <div className="speciesMapControlDist">Sort by</div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="radio" value="desc" name="sortBy" id={"sortBy1"}
                                   checked={sortDir === 'desc'}
                                   onChange={(e) => {
                                       if (e.target.checked) {
                                           resetView();
                                           setSortDir('desc')}}}/>
                            <label className="form-check-label" htmlFor={"sortBy1"}>
                                Latest
                            </label>
                        </div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="radio" value="asc" name="sortBy" id={"sortBy2"}
                                   checked={sortDir === 'asc'}
                                   onChange={(e) => {
                                       if (e.target.checked) {
                                           resetView();
                                           setSortDir('asc')}}}/>
                            <label className="form-check-label" htmlFor={"sortBy2"}>
                                Oldest
                            </label>
                        </div>
                    </div>

                    <div className="speciesMapControlItem">
                        <div className="speciesMapControlDist">Record type</div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="checkbox" checked={includeOccurrences} id={"typeOccurrence"}
                                onChange={() => {
                                    resetView(); setIncludeOccurrences(!includeOccurrences)}}/>
                            <label className="form-check-label" htmlFor={"typeOccurrence"}>
                                Occurrences
                            </label>
                        </div>
                        <div className="form-check speciesMapControlDistItem">
                            <input className="form-check-input" type="checkbox" checked={includeSpecimens} id={"typeSpecimens"}
                                   onChange={() => {resetView();setIncludeSpecimens(!includeSpecimens)}}/>
                            <label className="form-check-label" htmlFor={"typeSpecimens"}>
                                Specimens
                            </label>
                        </div>
                    </div>

                    <div className="speciesMapControlRefresh">
                        Refresh <span className="bi bi-arrow-clockwise"></span>
                    </div>

                </div>
            </div>
        </div>
    </>
}

export default ImagesView;
