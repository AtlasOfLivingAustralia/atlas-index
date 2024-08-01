import {useEffect, useState} from "react";
import {DataQualityInfo} from "../../api/sources/model.ts";
// import {Modal} from "react-bootstrap";


interface RecordImagesProps {
}

interface ImageItem {
    href: string,
    thumbnail: string,
    largeImage: string,
    url: string,
    originalUrl: string
    id: string,
    name: string,
    typeStatus: string,
    eventDate: string | undefined,
    collector: string,
    organization: string
}

interface RecordImagesProps {
    queryString?: string,
    dataQualityInfo?: DataQualityInfo
}

function RecordImages({queryString, dataQualityInfo}: RecordImagesProps) {

    const [page, setPage] = useState(0)
    const [images, setImages] = useState<ImageItem[]>([])
    const [image, setImage] = useState<ImageItem | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPage(0)
        setImages([])
        loadImages(0);
    }, [queryString, dataQualityInfo]);

    function formatDate(date: number) {
        return date ? new Date(date).toISOString().split('T')[0] : undefined;
    }

    function loadImages(page: number) {
        setLoading(true);
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrence/search?" + queryString + "&pageSize=20&fq=multimedia:Image&sort=identificationQualifier&dir=asc&facet=false&start=" + (page * 20))
            .then(response => response.json())
            .then(data => {
                setLoading(false);
                let newImages = []
                for (let el of data.occurrences) {
                    newImages.push({
                        href: "#/occurrence?id=" + el.uuid,
                        thumbnail: el.thumbnailUrl,
                        largeImage: el.largeImageUrl,
                        url: "https://images.ala.org.au/image/" + el.image,
                        originalUrl: el.imageUrl,
                        id: el.thumbnailUrl,
                        name: (el.raw_scientificName || el.scientificName),
                        typeStatus: el.typeStatus,
                        eventDate: formatDate(el.eventDate),
                        collector: el.collector,
                        organization: el.institutionName || el.dataResourceName
                    });
                }
                setImages([...images, ...newImages])
            });
    }

    return <>
        <h3 className="h3Small">Images from occurrence records</h3>

        <div id="container">
            {images.map((image, index) =>
                <div key={index} className="imgCon" onClick={() => {
                    setImage(image);
                    setShowModal(true)
                }}>
                    <div className="cbLink thumbImage tooltips" rel="thumbs" id="thumb" title="click to enlarge">
                        <img src={image.thumbnail} alt="image thumbnail"/>

                        <div className="meta brief">
                            {image.name}&nbsp;
                            <br/>
                            {image.organization}
                        </div>

                        <div className="meta detail">
                            {image.name}
                            <br/>
                            <div dangerouslySetInnerHTML={{__html: 'By: ' + image.collector}}></div>
                            <br/>
                            Date: {image.eventDate}
                            <br/>
                            {image.organization}
                        </div>
                    </div>
                </div>
            )}
            <br/>
            {loading && <div className="spinner-border" role="status" style={{height: "20px", width: "20px"}}>
                <span className="visually-hidden">Loading...</span>
            </div>}
            <br/>
            <button className="btn btn-sm border-black mt-3" onClick={() => {
                setPage(page + 1);
                loadImages(page)
            }}>Show More Images
            </button>
        </div>

        <Modal show={showModal} size="xl">
            <Modal.Header>
                <Modal.Title>Image</Modal.Title>
            </Modal.Header>
            {image &&
                <Modal.Body >
                    <div className="d-flex imageModal">
                        <img src={image.largeImage} alt="image" className="ms-auto me-auto imageModalImg"/>
                    </div>
                    <div className="card imageInfoBox">
                        <div className="card-body imageText">
                            {image.name}
                            {image.typeStatus && <><br/>{image.typeStatus}</>}
                            {image.collector && <><br/>
                                <div dangerouslySetInnerHTML={{__html: 'By: ' + image.collector}}></div>
                            </>}
                            {image.eventDate && <><br/>Date: {image.eventDate}</>}
                            {image.organization && <><br/>{image.organization}</>}
                            <br/>
                            <br/>
                            <a href={image.href}>View details of this record</a>
                            <br/>
                            <br/>
                            If this image is incorrectly identified please flag an issue on the <a
                            href={image.href}>record.</a>
                            <br/>
                            <br/>
                            <a href={image.url} target="_blank">View image</a>
                            <br/>
                            <br/>
                            <a className="btn border-black float-end" href={image.originalUrl} target="_blank"><i
                                className="bi bi-download me-1"></i>Download</a>
                        </div>
                    </div>

                </Modal.Body>
            }
            <Modal.Footer>
                <button className="btn border-black" onClick={() => setShowModal(false)}>Close</button>
            </Modal.Footer>
        </Modal>
    </>
}

export default RecordImages;
