/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Fragment, useCallback, useEffect, useState} from 'react';
import {faFilm, faVolumeUp,} from '@fortawesome/free-solid-svg-icons';
import classes from './species.module.css';
import FormatName from '../nameUtils/formatName.tsx';
import capitalise from '../../helpers/Capitalise.ts';
import missingImage from '../../image/missing-image.png';
import {FadeInImage, FontAwesomeIconLite, refineSection, RefineSectionItem,} from '@ala/common-ui';

interface MediaViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

interface MediaTypes {
    uuid: string;
    imageMetadata: {
        creator?: string;
        rightsHolder?: string;
        license?: string;
        imageId: string; height: number; width: number
    }[];
    videos: string[];
    sounds: string[];
    license?: string;
    eventDate?: string;
    institutionName?: string;
    dataResourceName?: string;
}

interface Items {
    creator?: string;
    rightsHolder?: string;
    license?: string;
    sourceName?: string;
    eventDate?: string;
    id: string;
    type: string;
    height: number;
    width: number;
    occurrenceId: string;
}

interface FacetResult {
    count: number;
    fq: string;
    i18nCode?: string;
    label: string;
}

interface FacetResultSet {
    fieldName: string;
    fieldResult: FacetResult[];
}

interface UserFq {
    [key: string]: string[];
}

enum MediaTypeEnum {
    all = 'all',
    image = 'image',
    video = 'video',
    sound = 'sound',
}

// "Grouped" filters require a mapping for the values to be grouped together
const fieldMapping = {
    basisOfRecord: {
        'Human observation': 'Observations',
        'Machine observation': 'Observations',
        'Preserved specimen': 'Specimens',
        'Fossil specimen': 'Specimens',
        'Living specimen': 'Specimens',
        'Material sample': 'Specimens',
        Observation: 'Observations',
        Occurrence: 'Observations',
        'Not supplied': 'Observations',
    },
    license: {
        CC0: 'CC0',
        'CC-BY 4.0 (Int)': 'CC-BY',
        'CC-BY-NC': 'CC-BY-NC',
        'CC-BY': 'CC-BY',
        'CC-BY-NC 4.0 (Int)': 'CC-BY-NC',
        'CC-BY 3.0 (Au)': 'CC-BY',
        'CC-BY-Int': 'CC-BY',
        'CC-BY 3.0 (Int)': 'CC-BY',
        'CC-BY-NC 3.0 (Au)': 'CC-BY-NC',
        'CC-BY 4.0 (Au)': 'CC-BY',
        'CC-BY-SA 4.0 (Int)': 'CC-BY-SA',
        'CC-BY-NC-SA 4.0 (Int)': 'CC-BY-NC-SA',
        'Creative Commons - license at record level':
            'Creative Commons - license at record level',
        'CC-BY-NC-ND 4.0 (Int)': 'CC-BY-NC-ND',
        'CC-BY 3.0 (NZ)': 'CC-BY',
        // 'Not supplied': 'Not supplied',
    },
};
const facetFields = [
    'basisOfRecord',
    'multimedia',
    'license',
    'dataResourceName',
];

function ImagesView({result, isMobile}: MediaViewProps) {
    const [items, setItems] = useState<Items[]>([]);
    const [facetResults, setFacetResults] = useState<FacetResultSet[]>([]); // from `facetResults` in the JSON response (unfilterded)
    const [fqUserTrigged, setFqUserTrigged] = useState<UserFq>({}); // from user interaction with the checkboxes
    const [page, setPage] = useState(0); // Note: not `start` but page number: 0, 1, 2, ...
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
    const [occurrenceCount, setOccurrenceCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [firstFetchDone, setFirstFetchDone] = useState(false);
    const [showRefineDialog, setShowRefineDialog] = useState(false);

    // Control of modal for image details
    const [openImageIdx, setOpenImageIdx] = useState(0);
    const [opened, setOpened] = useState<boolean>(false);

    // Build the `fq` query param (string, with multiple `fq` params for array-style facets)
    const fqParameterString = useCallback((): string => {
        const fqQueryList: String[] = facetFields.map((field) => {
            const fq = fqUserTrigged[field];
            return fq && fq.length > 0 ? `&fq=${fq.join('+OR+')}` : '';
        });
        return fqQueryList.join('');
    }, [fqUserTrigged]);

    const pageSize = 12;
    const facetLimit = 15;
    const gridHeight = 210;
    const gridWidthTypical = 240;

    useEffect(() => {
        fetchImages();
    }, [result, page, sortDir, fqUserTrigged]);

    function fetchImages() {
        if (!result?.guid) {
            return;
        }

        setLoading(true);

        let url = import.meta.env.VITE_APP_BIOCACHE_URL +
            '/occurrences/search?q=lsid:' + encodeURIComponent(result.guid) +
            (page == 0 ? `&facets=${facetFields.join(',')}` : '') +
            '&start=' + page * pageSize +
            '&pageSize=' + pageSize +
            '&dir=' + sortDir +
            '&sort=eventDate' + import.meta.env.VITE_GLOBAL_FQ +
            '&flimit=' + facetLimit + fqParameterString() +
            '&fq=multimedia:*&im=true';

        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                const list: Items[] = [];
                let fqMultimedia = fqUserTrigged['multimedia'] || [];
                let includeImages = fqMultimedia.length == 0 || fqMultimedia.includes('multimedia:"Image"');
                let includeSounds = fqMultimedia.length == 0 || fqMultimedia.includes('multimedia:"Sound"');
                let includeVideos = fqMultimedia.length == 0 || fqMultimedia.includes('multimedia:"Video"');
                data.occurrences.map((item: MediaTypes) => {
                    if (item.imageMetadata && includeImages) {
                        for (let image of item.imageMetadata) {
                            let aspectRatio = image.width / image.height;
                            if (result.hiddenImages_s && result.hiddenImages_s.includes(image.imageId)) {
                                continue;
                            }
                            list.push({
                                id: image.imageId,
                                occurrenceId: item.uuid,
                                type: MediaTypeEnum.image,
                                height: gridHeight,
                                width: gridHeight * aspectRatio > gridWidthTypical ? gridWidthTypical : gridHeight * aspectRatio,
                                creator: image.creator,
                                rightsHolder: image.rightsHolder,
                                license: image.license || item.license,
                                sourceName: item.institutionName || item.dataResourceName,
                                eventDate: item.eventDate
                            });
                        }
                    }
                    if (item.videos && includeVideos) {
                        for (let id of item.videos) {
                            if (result.hiddenImages_s && result.hiddenImages_s.includes(id)) {
                                continue;
                            }
                            list.push({
                                id: id,
                                type: MediaTypeEnum.video,
                                height: gridHeight,
                                width: gridWidthTypical,
                                occurrenceId: item.uuid,
                                license: item.license,
                                sourceName: item.institutionName || item.dataResourceName,
                                eventDate: item.eventDate
                            });
                        }
                    }
                    if (item.sounds && includeSounds) {
                        for (let id of item.sounds) {
                            if (result.hiddenImages_s && result.hiddenImages_s.includes(id)) {
                                continue;
                            }
                            list.push({
                                id: id,
                                type: MediaTypeEnum.sound,
                                height: gridHeight,
                                width: gridWidthTypical,
                                occurrenceId: item.uuid,
                                license: item.license,
                                sourceName: item.institutionName || item.dataResourceName,
                                eventDate: item.eventDate
                            });
                        }
                    }
                });

                if (page == 0) {
                    setItems(list);
                    setOccurrenceCount(data.totalRecords);
                    updateFacetResults(data.facetResults);
                } else {
                    setItems([...items, ...list]);
                }

                setFirstFetchDone(true);
            })
            .catch((error) => {
                console.error('Failed to fetch images - ' + error);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    // Initialises, aggregates, labels, and updates counts if needed for facets.
    function updateFacetResults(newFacetResults: FacetResultSet[]) {
        // iterate through facet results and perform aggregation using fieldMapping
        const aggregatedResults: FacetResultSet[] = [];
        for (const facet of newFacetResults) {
            const fieldName: string = facet.fieldName;
            // skip if no aggregation is needed
            let thisMapping: Record<string, string> | undefined =
                fieldMapping[fieldName as keyof typeof fieldMapping];
            if (!thisMapping) {
                aggregatedResults.push(facet);
                continue;
            }

            let newFieldResultsMap: Record<string, FacetResult> = {};
            for (const result of facet.fieldResult) {
                let mappedLabel = thisMapping[result.label];

                // Aggregate "Other"
                if (!mappedLabel) {
                    mappedLabel = 'Other';
                }

                // TODO: handle fq that is "-field:*", it cannot be joined with OR
                let aggregatedResult = newFieldResultsMap[mappedLabel];
                if (aggregatedResult) {
                    aggregatedResult.count += result.count;
                    aggregatedResult.fq += ` OR ${result.fq}`;
                } else {
                    newFieldResultsMap[mappedLabel] = {
                        label: mappedLabel,
                        count: result.count,
                        fq: result.fq,
                    };
                }
            }
            aggregatedResults.push({
                fieldName: fieldName,
                fieldResult: Object.values(newFieldResultsMap),
            });
        }

        if (!firstFetchDone) {
            setFacetResults(aggregatedResults);
        } else {
            // Facet selection was changed, only update existing facetResults counts
            for (const facet of facetResults) {
                const aggregatedFacet = aggregatedResults.find((f) => f.fieldName === facet.fieldName);
                if (aggregatedFacet) {
                    for (const result of facet.fieldResult) {
                        const aggregatedFacetItem = aggregatedFacet.fieldResult.find((r) => r.label === result.label);
                        result.count = aggregatedFacetItem ? aggregatedFacetItem.count : 0;
                    }
                }
            }
            setFacetResults([...facetResults]);
        }
    }

    const getImageThumbnailUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL}${id}`;
    };

    const getImageOriginalUrl = (id: string) => {
        return `${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/proxyImage?imageId=${id}`;
    };

    // Remove image from list if it fails to load
    const handleImageError = (idx: number, _e: any) => {
        setItems((prevItems) => prevItems.filter((_, index) => index !== idx));
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en').format(num); // TODO: move to helper and add locale detection
    };

    // Modal event handlers
    function handleOpenModal(idx: number) {
        if (isMobile) {
            // open image in a new tab instead of the modal
            window.open(import.meta.env.VITE_APP_IMAGE_BASE_URL + '/image/' + items[idx].id, '_blank');
            return;
        }

        setOpenImageIdx(idx);
        setOpened(true);

        // prepare the next page if this is the last image on the current page
        if (idx >= items.length - 2 && occurrenceCount > pageSize * (page + 1)) {
            setPage(page + 1);
        }
    }

    // Check if a facet value is active (should be shown as checked)
    const fqValueIsActive = (facetName: string, facetValue: string): boolean => {
        const fqTriggeredForField = fqUserTrigged[facetName];
        return fqTriggeredForField && fqTriggeredForField.length > 0 ? fqTriggeredForField?.includes(facetValue) : false;
    };

    // Add/remove a fq for a facet field. It handles multiple fq's for the same field, e.g. `multimedia:"Image" OR multimedia:"Video"`.
    const updateUserFqs = (fq: string, active: boolean, fieldName: string) => {
        setPage(0);
        setLoading(true);
        !active ? // add the fq
            setFqUserTrigged((prevState) => {
                const newFq = {...prevState};
                newFq[fieldName] = [...(newFq[fieldName] || []), fq];
                return newFq;
            })
            : (fqUserTrigged[fieldName] || []).length == 0 ? // add all other fq for this fieldName
                setFqUserTrigged((prevState) => {
                    const newFq = {...prevState};
                    newFq[fieldName] = facetResults.find((facet) => facet.fieldName === fieldName)?.fieldResult.filter((item) => item.fq !== fq).map((item) => item.fq) || [];
                    return newFq;
                })
                : // remove the fq
                setFqUserTrigged((prevState) => {
                    const newFq = {...prevState};
                    newFq[fieldName] = newFq[fieldName]?.filter((filter) => filter !== fq);
                    return newFq;
                });
    };

    // Create facet items for use in a refine section
    function itemsForFacet(fieldName: string, showCount: boolean = true): RefineSectionItem[] {
        if (!facetResults || facetResults.length === 0) {
            return [];
        }
        const fieldResult = facetResults.find((facet) => facet.fieldName === fieldName)?.fieldResult || [];
        return fieldResult.map((item) => ({
            label: (<>{item.label}{showCount ? ` (${formatNumber(item.count)})` : ''}</>),
            onClick: () => {
                const fq = item.fq;
                const isActive = fqValueIsActive(fieldName, fq);
                updateUserFqs(fq, isActive, fieldName);
            },
            isOpen: fqValueIsActive(fieldName, item.fq),
            isDisabled: () => item.count === 0,
        }));
    }

    const refineResults = <>
        {!firstFetchDone ? (<>
            <span className={`placeholder-glow ${classes.refineTitle}`}>
                <span className="placeholder col-8"
                      style={{width: '200px', borderRadius: '10px',}}>&nbsp;</span>
            </span>
            <br/>

            <span className={`placeholder-glow ${classes.refineSectionTitle}`}>
                <span className="placeholder col-8" style={{
                    width: '100px',
                    marginTop: '15px',
                    marginBottom: '10px',
                    borderRadius: '10px',
                }}>&nbsp;</span>
            </span>
            <br/>
            <span className={`placeholder-glow ${classes.refineItem}`}>
                <span className="placeholder col-8"
                      style={{width: '150px', height: '90px', borderRadius: '10px'}}>&nbsp;</span>
                </span>
            <br/>
            <span className={`placeholder-glow ${classes.refineSectionTitle}`}>
                <span className="placeholder col-8" style={{
                    width: '100px',
                    marginTop: '15px',
                    marginBottom: '10px',
                    borderRadius: '10px'
                }}>&nbsp;</span>
                </span>
            <br/>
            <span className={`placeholder-glow ${classes.refineItem}`}>
                <span className="placeholder col-8"
                      style={{width: '150px', height: '190px', borderRadius: '10px'}}>&nbsp;</span>
                </span>
        </>) : (<>
            {occurrenceCount != 0 && <>
                <span className={classes.refineTitle} style={{display: 'block'}}>Refine occurrences</span>

                {refineSection('Media type', itemsForFacet('multimedia'))}

                {refineSection('Occurrence type', itemsForFacet('basisOfRecord'))}

                {refineSection('Licence type', itemsForFacet('license'))}

                {refineSection('Dataset', itemsForFacet('dataResourceName'))}
            </>}
        </>)}
    </>

    return (<>
            <div className="d-flex flex-row gap-3">
                {!isMobile && <div style={{width: '250px'}}>
                    {refineResults}
                </div>
                }

                <div style={{flex: 1}}>
                    {isMobile && occurrenceCount !== 0 && (
                        <div style={{marginBottom: '15px'}}>
                            <button onClick={() => setShowRefineDialog(true)} className={'ala-btn-secondary'}
                                    style={{width: '100%'}}>
                                Refine occurrences
                            </button>
                        </div>
                    )}
                    <div className={'d-flex flex-wrap justify-content-between'} style={{rowGap: '30px'}}>
                        <span className={classes.resultsTitle}>
                            Showing{' '}
                            {loading ? (
                                <span className="placeholder-glow">
                                    <span className="placeholder col-8"
                                          style={{
                                              width: '20px',
                                              borderRadius: '10px',
                                          }}>&nbsp;</span>
                                </span>
                            ) : (items.length)}
                            {' '}media from{' '}
                            {loading && page == 0 ? (
                                <span className="placeholder-glow">
                                    <span className="placeholder col-8"
                                          style={{width: '20px', borderRadius: '10px'}}>&nbsp;</span>
                                </span>
                            ) : (formatNumber(occurrenceCount))}{' '}
                            occurrences</span>
                        {!isMobile && occurrenceCount !== 0 && <div className="d-flex align-items-center gap-3">
                            <span className={classes.headerLabels}>Sort by</span>
                            <select className={`form-select ${classes.alaSelect}`}
                                    value={sortDir}
                                    onChange={(e) => {
                                        setSortDir(e.target.value as 'desc' | 'asc');
                                        setPage(0);
                                    }}>
                                <option value={'desc'}>Oldest</option>
                                <option value={'asc'}>Newest</option>
                            </select>
                        </div>}
                    </div>
                    <div className={'d-flex flex-row flex-wrap'} style={{gap: '10px', marginTop: '20px'}}>
                        {loading &&
                            page == 0 &&
                            Array.from({length: 12}).map((_, idx) => (
                                <span className="placeholder-glow" key={idx}>
                                    <span
                                        className="placeholder col-8"
                                        style={{
                                            width: gridWidthTypical,
                                            height: gridHeight,
                                            borderRadius: '10px',
                                        }}
                                    ></span>
                                </span>
                            ))}
                        {(!loading || page > 0) && items && items.map((item, idx) => (
                            <Fragment key={idx}>
                                <div style={{
                                    overflow: 'hidden',
                                    borderRadius: 10,
                                    maxWidth: gridWidthTypical,
                                    height: gridHeight
                                }}>
                                    {item.type === MediaTypeEnum.image && (
                                        <img alt={`Image of ${result?.scientificName} (${idx + 1})`}
                                             style={{
                                                 borderRadius: '10px',
                                                 height: item.height,
                                                 width: item.width,
                                                 objectFit: 'cover',
                                                 transition: 'transform 0.3s ease',
                                                 backgroundColor: '#e2e2e2',
                                             }}
                                             src={getImageThumbnailUrl(item.id)}
                                             onMouseOver={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.1)';
                                             }}
                                             onMouseOut={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.0)';
                                             }}
                                             onLoad={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 if (target && target.complete) {
                                                     setLoading(false);
                                                 }
                                             }}
                                             onError={(e) => handleImageError(idx, e)}
                                             onClick={() => handleOpenModal(idx)}
                                        />
                                    )}
                                    {(item.type === MediaTypeEnum.sound || item.type === MediaTypeEnum.video) && (
                                        <button type="button"
                                                className={`btn btn-outline-secondary ${classes.mediaIconBtn}`}
                                                style={{
                                                    width: 200,
                                                    height: '100%',
                                                    borderRadius: 10,
                                                    whiteSpace: 'normal',
                                                    wordBreak: 'break-word',
                                                }}
                                                onClick={() => handleOpenModal(idx)}
                                        >
                                            {item.type === MediaTypeEnum.sound && (
                                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 15}}>
                                                    <FontAwesomeIconLite icon={faVolumeUp} size="2xl" color="gray"
                                                                         style={{fontSize: 40}}/>
                                                    Sound file
                                                </span>
                                            )}
                                            {item.type === MediaTypeEnum.video && (
                                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 15}}>
                                                    <FontAwesomeIconLite icon={faFilm} size="2xl" color="gray"
                                                                         style={{fontSize: 40}}/>
                                                    Video file
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </Fragment>
                        ))}
                    </div>

                    {items && items.length > 0 && occurrenceCount > page * pageSize && (
                        <div className="d-flex justify-content-center align-items-center mt-4">
                            <button type="button" className="btn btn-outline-secondary rounded-pill px-5 py-2"
                                    onClick={() => setPage(page + 1)}
                                    disabled={(page + 1) * pageSize >= occurrenceCount || loading}
                                    aria-label="Load more images"
                                    style={{cursor: loading ? 'wait' : 'pointer'}}>
                                View more{loading}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {opened && (
                <div role="dialog" aria-labelledby="dialogTitle" aria-modal="true" className={classes.dialogContainer}
                     onClick={(e) => e.target === e.currentTarget && setOpened(false)}>
                    <div className={classes.dialogContent}>
                        <button aria-label="Previous image" className={classes.imageDialogButton}
                                style={{left: '15px', cursor: openImageIdx === 0 ? 'not-allowed' : 'pointer'}}
                                onClick={() => setOpenImageIdx((idx) => Math.max(0, idx - 1))}
                                disabled={openImageIdx === 0}>&lt;</button>

                        <button aria-label="Next image" className={classes.imageDialogButton}
                                onClick={() => {
                                    // load the next page if the next image is the last one on the page
                                    if (openImageIdx >= items.length - 2 && occurrenceCount > pageSize * (page + 1)) {
                                        setPage(page + 1);
                                    }
                                    setOpenImageIdx((idx) => idx + 1);
                                }}
                                disabled={openImageIdx === items.length - 1}
                                style={{
                                    right: '15px',
                                    cursor: loading ? 'wait' : (openImageIdx === items.length - 1 ? 'not-allowed' : 'pointer'),
                                }}>
                            &gt;</button>

                        <div style={{display: 'flex', justifyContent: 'center', height: '30px'}}>
                            <span className={classes.refineTitle} id="dialogTitle">
                                {loading || openImageIdx >= items.length || !result ? ('Loading...') : (<>
                                    {capitalise(items[openImageIdx].type)}{' '}of{' '}
                                    <FormatName name={result.scientificName} rankId={result.rank}/>{' '}
                                    ({openImageIdx + 1})
                                </>)}
                            </span>
                        </div>
                        <button className={classes.dialogCloseButton} onClick={() => setOpened(false)}
                                aria-label="Close">
                            &times;
                        </button>

                        <div style={{
                            marginTop: '30px',
                            borderRadius: '10px',
                            height: 'calc(100vh - 350px)',
                            textAlign: 'center'
                        }}>
                            <a href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${items[openImageIdx].id}`}
                               target="_blank">
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%'
                                }}>
                                    {items[openImageIdx].type ===
                                        MediaTypeEnum.image && (
                                            <FadeInImage src={getImageOriginalUrl(items[openImageIdx].id)}
                                                         style={{
                                                             borderRadius: '10px',
                                                             maxHeight: '100%',
                                                             maxWidth: '100%',
                                                             objectFit: 'contain',
                                                         }}
                                                         missingImage={missingImage}
                                                         showLoadingSpinner={true}
                                            />
                                        )}
                                    {items[openImageIdx].type === MediaTypeEnum.sound && (
                                        <audio key={items[openImageIdx].id} controls preload="auto"
                                               style={{width: '50vw'}}>
                                            <source
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${items[openImageIdx].id}`}
                                                type="audio/mpeg"/>
                                        </audio>
                                    )}
                                    {items[openImageIdx].type === MediaTypeEnum.video && (
                                        <video key={items[openImageIdx].id} controls preload="false"
                                               style={{maxWidth: '100%', maxHeight: '100%', borderRadius: '10px'}}>
                                            <source
                                                src={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/proxyImage?imageId=${items[openImageIdx].id}`}/>
                                        </video>
                                    )}
                                </div>
                            </a>
                        </div>
                        <div className="d-flex flex-row justify-content-between align-items-center">
                            <div className="d-flex flex-column" style={{maxWidth: '50%', overflow: 'auto'}}>
                                {items[openImageIdx].creator &&
                                    <span>Rights holder: {items[openImageIdx].rightsHolder}</span>}
                                {/*{items[openImageIdx].license && <span>License: {items[openImageIdx].license}</span>}*/}
                                {items[openImageIdx].eventDate &&
                                    <span>Date: {new Date(items[openImageIdx].eventDate).toLocaleDateString()}</span>}
                                {items[openImageIdx].sourceName && <span>{items[openImageIdx].sourceName}</span>}
                            </div>
                            <div className="d-flex justify-content-end flex-wrap" style={{
                                rowGap: '10px',
                                columnGap: '30px',
                                marginTop: '30px'
                            }}>
                                <a href={`${import.meta.env.VITE_APP_BIOCACHE_UI_URL}/occurrences/${encodeURIComponent(items[openImageIdx].occurrenceId)}`}
                                   target="_blank" className="btn ala-btn-primary">
                                    View occurrence details
                                </a>
                                <a href={`${import.meta.env.VITE_APP_IMAGE_BASE_URL}/image/${items[openImageIdx].id}`}
                                   target="_blank"
                                   className="btn ala-btn-primary">
                                    View {items[openImageIdx].type} details
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showRefineDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                     onClick={() => setShowRefineDialog(false)}>
                    <div style={{
                        background: '#fff',
                        borderRadius: '5px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '15px',
                        position: 'relative'
                    }}
                         onClick={(e) => e.stopPropagation()}>
                        <button style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem'
                        }}
                                onClick={() => setShowRefineDialog(false)}
                                aria-label="Close">&times;</button>
                        {refineResults}
                    </div>
                </div>
            )}
        </>
    );
}

export default ImagesView;
