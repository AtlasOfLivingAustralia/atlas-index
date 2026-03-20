/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {Modal} from "react-bootstrap";
import {FormattedMessage} from "react-intl";
import {DataQualityInfo} from "../api/model.tsx";


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

const pageSize = 20;

function RecordImages({queryString, dataQualityInfo}: RecordImagesProps) {

    const [page, setPage] = useState(0)
    const [images, setImages] = useState<ImageItem[]>([])
    const [image, setImage] = useState<ImageItem | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(false);
    const [noMoreImages, setNoMoreImages] = useState(false);

    useEffect(() => {
        setPage(0)
        setImages([])
        loadImages(0);
        setNoMoreImages(false);
    }, [queryString, dataQualityInfo]);

    function formatDate(date: number) {
        return date ? new Date(date).toISOString().split('T')[0] : undefined;
    }

    function loadImages(page: number) {
        setLoading(true);
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrence/search?" + queryString + "&pageSize=" + pageSize + "&fq=multimedia:Image&sort=identificationQualifier&dir=asc&facet=false&start=" + (page * pageSize))
            .then(response => response.json())
            .then(data => {
                setLoading(false);
                let newImages = []
                for (let el of data.occurrences) {
                    newImages.push({
                        href: "/occurrence/" + el.uuid,
                        thumbnail: el.thumbnailUrl,
                        largeImage: el.largeImageUrl,
                        url: import.meta.env.VITE_APP_IMAGE_SERVICE_URL + "/image/" + el.image,
                        originalUrl: el.imageUrl,
                        id: el.thumbnailUrl,
                        name: (el.raw_scientificName || el.scientificName),
                        typeStatus: el.typeStatus,
                        eventDate: formatDate(el.eventDate),
                        collector: el.collector,
                        organization: el.institutionName || el.dataResourceName
                    });
                }
                if (newImages.length < pageSize) {
                    setNoMoreImages(true);
                }
                setImages([...images, ...newImages])
            });
    }

    return <>
        <h3 className="h3Small"><FormattedMessage id={'list.speciesgallerycontrols.recordimages.title'} defaultMessage={'Images from occurrence records'}/></h3>

        <div id="container">
            {images.map((image, index) =>
                <div key={index} className="imgCon" onClick={() => {setImage(image); setShowModal(true)}}>
                    <div className="cbLink thumbImage tooltips" rel="thumbs" id="thumb" title="click to enlarge">
                        <img src={image.thumbnail} alt={image.name + " image thumbnail"}/>

                        <div className="meta brief">
                            {image.name}
                        </div>

                        <div className="meta detail">
                            {image.name}
                            <div dangerouslySetInnerHTML={{__html: 'By: ' + image.collector}}></div>
                            Date: {image.eventDate}
                            <br/>
                            {image.organization}
                        </div>
                    </div>
                </div>
            )}
            <br/>
            {loading && <div className="spinner-border" role="status" style={{height: "20px", width: "20px"}}>
                    <span className="visually-hidden"><FormattedMessage id="list.speciesgallerycontrols.imagesgrid" defaultMessage="loading images"/>...</span>
            </div>}
            {!loading && !noMoreImages && <>
                <br/>
                <button className="btn btn-sm border-black mt-3" onClick={() => {setPage(page + 1);loadImages(page)}}>
                    <FormattedMessage id="list.speciesgallerycontrols.loadmoreimages.button" defaultMessage="Show more images"/>
                </button>
            </>}
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
