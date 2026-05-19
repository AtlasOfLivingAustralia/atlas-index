/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {FormattedMessage} from "react-intl";
import {DataQualityInfo} from "../api/model.tsx";
import classes from './recordImages.module.css';
import missingImage from '../image/missing-image.png';


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
    const [openImageIdx, setOpenImageIdx] = useState(0)
    const [opened, setOpened] = useState(false)
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
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrence/search" + queryString + "&pageSize=" + pageSize + "&fq=multimedia:Image&sort=identificationQualifier&dir=asc&facet=false&start=" + (page * pageSize))
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
                setImages(prev => [...prev, ...newImages])
            });
    }

    function handleOpenModal(idx: number) {
        setOpenImageIdx(idx);
        setOpened(true);
        // preload next page if approaching the end
        if (idx >= images.length - 2 && !noMoreImages) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadImages(nextPage);
        }
    }

    function downloadImage(url: string, name: string) {
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const ext = blob.type.split('/')[1] || 'jpg';
                const filename = `${name || 'image'}.${ext}`;
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(objectUrl);
            });
    }

    function handleNext() {
        const nextIdx = openImageIdx + 1;
        if (nextIdx >= images.length - 2 && !noMoreImages) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadImages(nextPage);
        }
        setOpenImageIdx(nextIdx);
    }

    return <>
        <h3 className="h3Small"><FormattedMessage id={'list.speciesgallerycontrols.recordimages.title'} defaultMessage={'Images from occurrence records'}/></h3>

        <div id="container">
            {images.map((image, index) =>
                <div key={index} className="imgCon" onClick={() => handleOpenModal(index)}>
                    <div className="cbLink thumbImage tooltips" rel="thumbs" id="thumb" title="click to enlarge">
                        <img src={image.thumbnail} alt={image.name + " image thumbnail"} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = missingImage; }}/>

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
                <button className="btn btn-sm btn-outline-dark mt-3" onClick={() => {setPage(page + 1);loadImages(page)}}>
                    <FormattedMessage id="list.speciesgallerycontrols.loadmoreimages.button" defaultMessage="Show more images"/>
                </button>
            </>}
        </div>

        {opened && images[openImageIdx] && (
            <div role="dialog" aria-labelledby="imageDialogTitle" aria-modal="true"
                 className={classes.dialogContainer}
                 onClick={(e) => e.target === e.currentTarget && setOpened(false)}>
                <div className={classes.dialogContent}>

                    {/* Prev / Next nav buttons */}
                    <button aria-label="Previous image" className={classes.imageDialogButton}
                            style={{left: '15px', cursor: openImageIdx === 0 ? 'not-allowed' : 'pointer'}}
                            onClick={() => setOpenImageIdx(idx => Math.max(0, idx - 1))}
                            disabled={openImageIdx === 0}>&lt;</button>

                    <button aria-label="Next image" className={classes.imageDialogButton}
                            style={{right: '15px', cursor: (loading || openImageIdx === images.length - 1) ? (loading ? 'wait' : 'not-allowed') : 'pointer'}}
                            onClick={handleNext}
                            disabled={openImageIdx === images.length - 1 && noMoreImages}>&gt;</button>

                    {/* Title */}
                    <div style={{display: 'flex', justifyContent: 'center', height: '30px'}}>
                        <span className={classes.dialogTitle} id="imageDialogTitle">
                            {images[openImageIdx].name} ({openImageIdx + 1})
                        </span>
                    </div>

                    {/* Close button */}
                    <button className={classes.dialogCloseButton} onClick={() => setOpened(false)} aria-label="Close">
                        &times;
                    </button>

                    {/* Main image — fills remaining vertical space so no scrolling needed */}
                    <div className={classes.imageArea}>
                            <img
                                src={images[openImageIdx].largeImage}
                                alt={images[openImageIdx].name}
                                style={{borderRadius: '10px', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain'}}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = missingImage; }}
                            />
                    </div>

                    {/* Metadata + action buttons */}
                    <div className="d-flex flex-row justify-content-between align-items-start" style={{marginTop: '12px', flexWrap: 'wrap', gap: '10px'}}>
                        <div className="d-flex flex-column" style={{maxWidth: '55%'}}>
                            {images[openImageIdx].typeStatus && <span><strong>Type status:</strong> {images[openImageIdx].typeStatus}</span>}
                            {images[openImageIdx].collector && <span dangerouslySetInnerHTML={{__html: '<strong>By:</strong> ' + images[openImageIdx].collector}}/>}
                            {images[openImageIdx].eventDate && <span><strong>Date:</strong> {images[openImageIdx].eventDate}</span>}
                            {images[openImageIdx].organization && <span>{images[openImageIdx].organization}</span>}
                            <span style={{marginTop: '6px'}}>If this image is incorrectly identified please flag an issue on the <a href={images[openImageIdx].href}>record</a>.</span>
                        </div>
                        <div className="d-flex flex-wrap justify-content-end" style={{rowGap: '10px', columnGap: '10px'}}>
                            <a href={images[openImageIdx].href} className="btn btn-outline-dark">
                                View details of this record
                            </a>
                            <a href={images[openImageIdx].url} target="_blank" className="btn btn-outline-dark">
                                View image
                            </a>
                            <button onClick={() => downloadImage(images[openImageIdx].originalUrl, images[openImageIdx].name)} className="btn btn-outline-dark">
                                <i className="bi bi-download me-1"></i>Download
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        )}
    </>
}

export default RecordImages;
