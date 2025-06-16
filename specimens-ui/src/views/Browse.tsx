/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState, useRef} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import useHashState from "../components/util/useHashState.tsx";
import {useParams} from "react-router-dom";
import missingImage from '../image/missing-image.svg';

const MAX_ROW_HEIGHT = 200; // maximum height of each image row, adjust as needed

type ImageData = {
    uuid: string;
    scientificName: string;
    vernacularName?: string;
    typeStatus?: string;
    imageId: string;
    thumbWidth: number;
    thumbHeight: number;
    rightsHolder?: string;
    license?: string;
    largeImageViewerUrl: string;
    smallImageUrl: string;
    recordLink: string;
};

type FacetValue = {
    label: string;
    count: number;
    fq: string;
    fieldName: string;
};

type Facet = {
    fieldName: string;
    fieldResult: FacetValue[];
};

type TaxonomyCurrentRank = {
    currentRankLabel?: string;
    values?: FacetValue[];
};

type TaxonomyHierarchyLevel = {
    displayRank: string;
    name: string;
};

interface BrowseProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}

/**
 * Browse biocache occurrence images. Has a filter on the left, and a grid of images on the right.
 *
 * @param setBreadcrumbs
 * @constructor
 */
function Browse({setBreadcrumbs}: BrowseProps) {
    const [images, setImages] = useState<ImageData[]>([]);
    const [facets, setFacets] = useState<Facet[]>([]);
    const [taxonomyHierarchy, setTaxonomyHierarchy] = useState<TaxonomyHierarchyLevel[]>([]);
    const [taxonomyCurrentRank, setTaxonomyCurrentRank] = useState<TaxonomyCurrentRank>({
        currentRankLabel: "",
        values: []
    });
    const [loadStatus, setLoadStatus] = useState("loading");
    const [totalRecords, setTotalRecords] = useState(-1);
    const [offset, setOffset] = useState(0);
    const [fqTypeStatus, setFqTypeStatus] = useHashState("typeStatus", "");
    const [fqFirstImageOnly, setFqFirstImageOnly] = useHashState("firstImageOnly", true);
    const [fqSex, setFqSex] = useHashState("raw_sex", "");
    const [fqKingdom, setFqKingdom] = useHashState("kingdom", "");
    const [fqPhylum, setFqPhylum] = useHashState("phylum", "");
    const [fqClass, setFqClass] = useHashState("class", "");
    const [fqOrder, setFqOrder] = useHashState("order", "");
    const [fqFamily, setFqFamily] = useHashState("family", "");
    const [fqGenus, setFqGenus] = useHashState("genus", "");
    const [fqSpecies, setFqSpecies] = useHashState("species", "");
    const [entityName, setEntityName] = useState("all collections");

    const {entityUid = ""} = useParams<{ entityUid?: string }>();

    const imageContainerRef = useRef<HTMLDivElement | null>(null);

    const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'],
        facetNames: Record<string, string> = {
            'typeStatus': 'Types', 'raw_sex': 'Sex', 'family': 'Family', 'order': 'Order', 'class': 'Class',
            'kingdom': 'Kingdom', 'phylum': 'Phylum', 'genus': 'Genus', 'species': 'Species'
        },
        facetsToShow = ["typeStatus", "raw_sex"],
        baseQuery = "?q=multimedia:Image&im=true&fl=id,collectionName,institution,dataProviderName,dataResourceName,images,typeStatus,scientificName,raw_scientificName,vernacularName",
        pageSize = 100;

    useEffect(() => {
        setBreadcrumbs([
            {title: "Home", href: import.meta.env.VITE_HOME_URL},
            {title: "Specimen Images", href: '/'},
            {title: entityName, href: ""}
        ])
    }, [entityName]);

    useEffect(() => {
        fetchData();
    }, [entityUid, fqTypeStatus, fqSex, fqKingdom, fqPhylum, fqClass, fqOrder, fqFamily, fqGenus, fqSpecies, fqFirstImageOnly]);

    const onClearAllFilters = () => {
        let hasChanged = fqTypeStatus != "" || fqSex != "" || fqKingdom != "" || fqPhylum != "" ||
            fqClass != "" || fqOrder != "" || fqFamily != "" || fqGenus != "" || fqSpecies != "";

        if (hasChanged) {
            resetResults();

            setFqTypeStatus("");
            setFqSex("");
            setFqKingdom("");
            setFqPhylum("");
            setFqClass("");
            setFqOrder("");
            setFqFamily("");
            setFqGenus("");
            setFqSpecies("");
        }
    }

    const onShowMoreResults = () => {
        const newOffset = offset + pageSize;
        setOffset(newOffset);
        fetchData(newOffset);
    }

    const fetchData = (currentOffset = offset) => {
        setLoadStatus("loading");

        var url = import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search" + baseQuery;
        url += "&pageSize=" + pageSize;
        url += "&start=" + currentOffset;

        let currentRank = getCurrentRank();
        // fetch facets when not loading more images
        if (currentOffset == 0) {
            url += "&facets=" + facetsToShow.join(",") + "," + currentRank;
        }

        if (fqTypeStatus) {
            url += "&fq=" + fqTypeStatus;
        }
        if (fqSex) {
            url += "&fq=" + fqSex;
        }
        if (fqKingdom) {
            url += "&fq=" + fqKingdom;
        }
        if (fqPhylum) {
            url += "&fq=" + fqPhylum;
        }
        if (fqClass) {
            url += "&fq=" + fqClass;
        }
        if (fqOrder) {
            url += "&fq=" + fqOrder;
        }
        if (fqFamily) {
            url += "&fq=" + fqFamily;
        }
        if (fqGenus) {
            url += "&fq=" + fqGenus;
        }
        if (fqSpecies) {
            url += "&fq=" + fqSpecies;
        }
        if (entityUid) {
            if (entityUid.startsWith('c')) {
                url += "&fq=collectionUid:" + entityUid;
            } else if (entityUid.startsWith('dr')) {
                url += "&fq=dataResourceUid:" + entityUid;
            } else if (entityUid.startsWith('dp')) {
                url += "&fq=dataProviderUid:" + entityUid;
            } else if (entityUid.startsWith('i')) {
                url += "&fq=institutionUid:" + entityUid;
            }
        }

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        setLoadStatus("no results");
                    } else {
                        console.log(response)
                        setLoadStatus("error");
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json()
            })
            .then(data => {
                // do not update these if we are loading more images
                if (currentOffset == 0) {
                    if (entityUid) {
                        setEntityName(data.occurrences.length > 0 ? getEntityNameFromOccurrence(data.occurrences[0]) : entityUid);
                    }

                    // automatically drill down to the current rank if there is only one facet value for the current rank
                    if (data.facetResults && data.facetResults.length > 0) {
                        const currentRankFacet = data.facetResults.find((f: any) => f.fieldName === currentRank);
                        if (currentRankFacet && currentRankFacet.fieldResult.length === 1) {
                            const singleValue = currentRankFacet.fieldResult[0];
                            addFq(currentRank, singleValue.fq); // this will trigger another fetchData call
                            return;
                        }
                    }

                    setFacets(data.facetResults);
                    setTotalRecords(data.totalRecords);
                    buildHierarchyFilters();
                    buildHierarchyDrilldown(data);
                }

                let newImages: ImageData[] = [];
                data.occurrences.forEach((occ: any) => {
                    for (let img of occ.imageMetadata) {
                        newImages.push({
                            uuid: occ.uuid,
                            scientificName: occ.scientificName || occ.raw_scientificName,
                            vernacularName: occ.vernacularName,
                            typeStatus: occ.typeStatus,
                            imageId: img.imageId,
                            thumbWidth: img.thumbWidth,
                            thumbHeight: img.thumbHeight,
                            rightsHolder: img.rightsHolder,
                            license: img.license,
                            largeImageViewerUrl: import.meta.env.VITE_APP_IMAGES_URL + "/image/" + img.imageId,
                            smallImageUrl: img.thumbUrl,
                            recordLink: import.meta.env.VITE_APP_BIOCACHE_UI_URL + "/occurrences/" + occ.uuid
                        });
                        if (fqFirstImageOnly) {
                            // if first image only, break after the first image
                            break;
                        }
                    }
                });
                setImages(prevImages => [...prevImages, ...newImages]);
                setLoadStatus("done");
            })
            .catch((e) => {
                console.error("Error fetching data:", e);
                setLoadStatus("error");
            });
    }

    const formatFq = (fq: string) => {
        // fqs are in the form field:"value" or -field:*
        if (fq.startsWith("-")) {
            return "Not supplied";
        } else {
            const parts = fq.split(":");
            if (parts.length > 1) {
                return parts.slice(1).join(":").replace(/"/g, '');
            }
            return fq.replace(/"/g, '');
        }
    }

    const getEntityNameFromOccurrence = (occurrence: any) => {
        if (entityUid.startsWith('c')) {
            return occurrence.collectionName;
        } else if (entityUid.startsWith('dr')) {
            return occurrence.dataResourceName;
        } else if (entityUid.startsWith('dp')) {
            return occurrence.dataProviderName;
        } else if (entityUid.startsWith('i')) {
            return occurrence.institutionName;
        }
        return entityUid;
    }

    const buildHierarchyFilters = () => {
        let hierarchy: TaxonomyHierarchyLevel[] = [];
        if (fqKingdom) {
            hierarchy.push({
                displayRank: "Kingdom",
                name: formatFq(fqKingdom)
            });
        }
        if (fqPhylum) {
            hierarchy.push({
                displayRank: "Phylum",
                name: formatFq(fqPhylum)
            });
        }
        if (fqClass) {
            hierarchy.push({
                displayRank: "Class",
                name: formatFq(fqClass)
            });
        }
        if (fqOrder) {
            hierarchy.push({
                displayRank: "Order",
                name: formatFq(fqOrder)
            });
        }
        if (fqFamily) {
            hierarchy.push({
                displayRank: "Family",
                name: formatFq(fqFamily)
            });
        }
        if (fqGenus) {
            hierarchy.push({
                displayRank: "Genus",
                name: formatFq(fqGenus)
            });
        }
        if (fqSpecies) {
            hierarchy.push({
                displayRank: "Species",
                name: formatFq(fqSpecies)
            });
        }

        setTaxonomyHierarchy(hierarchy);
    }

    const getCurrentRank = () => {
        var currentRank = "kingdom";
        if (fqKingdom) {
            currentRank = "phylum";
        }
        if (fqPhylum) {
            currentRank = "class";
        }
        if (fqClass) {
            currentRank = "order";
        }
        if (fqOrder) {
            currentRank = "family";
        }
        if (fqFamily) {
            currentRank = "genus";
        }
        if (fqGenus) {
            currentRank = "species";
        }
        if (fqSpecies) {
            currentRank = "";
        }
        return currentRank;
    }

    const buildHierarchyDrilldown = (data: any) => {
        var currentRank = getCurrentRank();
        let values = [];
        if (currentRank && data.facetResults) {
            let result = data.facetResults.find((f: any) => f.fieldName === currentRank)
            if (result) {
                for (let item of result.fieldResult) {
                    values.push({label: item.label, count: item.count, fq: item.fq, fieldName: currentRank});
                }
            }
        }
        setTaxonomyCurrentRank({
            currentRankLabel: currentRank ? facetNames[currentRank] : "",
            values: values
        });
    }

    const resetResults = () => {
        setImages([]);
        setOffset(0);
        setFacets([]);
        setTaxonomyCurrentRank({})
        setTaxonomyHierarchy([]);
    }

    const addFq = (fieldName: string, fq: string) => {
        // reset results before the drill down
        resetResults();

        if (fieldName === "typeStatus") {
            setFqTypeStatus(fq);
        } else if (fieldName === "raw_sex") {
            setFqSex(fq);
        }

        setRankFq(fieldName, fq);
    }

    const removeFq = (fieldName: string) => {
        // reset results before the drill up
        resetResults();

        if (fieldName === "typeStatus") {
            setFqTypeStatus("");
        } else if (fieldName === "raw_sex") {
            setFqSex("");
        } else if (fieldName === "kingdom") {
            setFqKingdom("");
        } else if (fieldName === "phylum") {
            setFqPhylum("");
        } else if (fieldName === "class") {
            setFqClass("");
        } else if (fieldName === "order") {
            setFqOrder("");
        } else if (fieldName === "family") {
            setFqFamily("");
        } else if (fieldName === "genus") {
            setFqGenus("");
        } else if (fieldName === "species") {
            setFqSpecies("");
        }
    }

    const removeLowerRanks = (rank: string) => {
        // reset results before the drill up
        resetResults();

        const rankIndex = ranks.indexOf(rank.toLowerCase());
        if (rankIndex === -1) return;

        // remove all lower ranks
        for (let i = rankIndex + 1; i < ranks.length; i++) {
            const fieldName = ranks[i];
            setRankFq(fieldName, "");
        }
    }

    const setRankFq = (fieldName: string, value: string) => {
        if (fieldName === "kingdom") {
            setFqKingdom(value);
        } else if (fieldName === "phylum") {
            setFqPhylum(value);
        } else if (fieldName === "class") {
            setFqClass(value);
        } else if (fieldName === "order") {
            setFqOrder(value);
        } else if (fieldName === "family") {
            setFqFamily(value);
        } else if (fieldName === "genus") {
            setFqGenus(value);
        } else if (fieldName === "species") {
            setFqSpecies(value);
        }
    }

    useEffect(() => {
        layoutImages(imageContainerRef, MAX_ROW_HEIGHT);
        window.addEventListener('resize', () => layoutImages(imageContainerRef, MAX_ROW_HEIGHT));
        return () => window.removeEventListener('resize', () => layoutImages(imageContainerRef, MAX_ROW_HEIGHT));
    }, [images]);

    // Utility to layout images in a gapless style using a ref
    function layoutImages(imageContainerRef: React.RefObject<HTMLDivElement | null>, maxRowHeight: number = MAX_ROW_HEIGHT) {
        const container = imageContainerRef.current;

        if (!container) return;

        const images = Array.from(container.querySelectorAll('img'));
        const size = container.clientWidth - 30;
        let remainingImages = images.slice();

        function getHeight(imgs: HTMLImageElement[], width: number) {
            width -= imgs.length * 5;
            let h = 0;
            for (const img of imgs) {
                const w = Number(img.getAttribute('data-width')) || img.naturalWidth || img.width;
                const ht = Number(img.getAttribute('data-height')) || img.naturalHeight || img.height;
                h += w / ht;
            }
            return width / h;
        }

        function setHeight(imgs: HTMLImageElement[], height: number) {
            for (const img of imgs) {
                const w = Number(img.getAttribute('data-width')) || img.naturalWidth || img.width;
                const ht = Number(img.getAttribute('data-height')) || img.naturalHeight || img.height;
                img.style.width = `${height * w / ht}px`;
                img.style.height = `${height}px`;
            }
        }

        while (remainingImages.length > 0) {
            let slice: HTMLImageElement[] = [];
            let h = 0;
            for (let i = 1; i <= remainingImages.length; ++i) {
                slice = remainingImages.slice(0, i);
                h = getHeight(slice, size);
                if (h < maxRowHeight) {
                    setHeight(slice, h);
                    remainingImages = remainingImages.slice(i);
                    break;
                }
                if (i === remainingImages.length) {
                    setHeight(slice, Math.min(maxRowHeight, h));
                    remainingImages = [];
                }
            }
        }
    }

    return (
        <>
            <div className="page-header p-4">
                <h2>Specimen images from <span>{entityName}</span></h2>
            </div>
            <div className="row">
                <div className="col-md-3 bg-light border rounded p-4">
                    <div className="d-flex justify-content-end mb-3">
                        <label htmlFor="firstImageOnly">
                            Show only the first image for a record&nbsp;
                        </label>
                        <input
                            type="checkbox"
                            id="firstImageOnly"
                            checked={fqFirstImageOnly}
                            onChange={e => setFqFirstImageOnly(e.target.checked)}
                        />
                    </div>
                    <div className="d-flex justify-content-end">
                        <button className="btn btn-default"
                                onClick={onClearAllFilters}>Clear filters
                        </button>
                    </div>
                    <div className={"ps-3"}>
                        <div id="taxonomyFacet" className="mb-3">
                            <h3>Taxonomy</h3>
                            <ul style={{marginLeft: 0, marginBottom: 0}}>
                                {taxonomyHierarchy.map((level, i) => (
                                    <li key={i}>
                                        <span style={{
                                            fontWeight: "bold",
                                            marginLeft: (ranks.indexOf(level?.displayRank?.toLowerCase()) * 10) + "px"
                                        }}>{level.displayRank}</span>:&nbsp;
                                        <span
                                            className={(taxonomyCurrentRank.values || "").length > 0 || i < taxonomyHierarchy.length - 1 ? "clickable" : ""}
                                            onClick={() => removeLowerRanks(level.displayRank)}>{level.name}</span>
                                    </li>
                                ))}
                                <li>
                                    <span style={{
                                        fontWeight: "bold",
                                        marginLeft: (ranks.indexOf((taxonomyCurrentRank?.currentRankLabel || "").toLowerCase()) * 10) + "px"
                                    }}>{taxonomyCurrentRank.currentRankLabel}</span>
                                    <ul>
                                        {taxonomyCurrentRank.values?.map((val, i) => (
                                            <li key={i}>
                                                    <span className="clickable"
                                                          style={{marginLeft: (ranks.indexOf((taxonomyCurrentRank?.currentRankLabel || "").toLowerCase()) * 10) + "px"}}
                                                          onClick={() => addFq(val.fieldName, val.fq)}>
                                                        <span>{val.label}</span> ({val.count})
                                                    </span>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            </ul>
                        </div>
                        {facets.filter((it) => facetsToShow.includes(it.fieldName)).map((facet, i) => (
                            <div key={i}>
                                <h3 style={{marginBottom: "5px", lineHeight: "30px"}}>{facetNames[facet.fieldName]}</h3>
                                <ul>
                                    {facet.fieldResult.map((val, j) => (
                                        <li key={j}>
                                                        <span className="clickable"
                                                              onClick={() => addFq(facet.fieldName, val.fq)}>
                                                            <span>{val.label}</span> ({val.count})
                                                        </span>
                                        </li>
                                    ))}
                                    <li>
                                        <span className="clickable"
                                              onClick={() => removeFq(facet.fieldName)}>all values</span>
                                    </li>
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="col-md-9 ps-4 pe-4">
                    {loadStatus === "done" && (
                        <div className="alert alert-info">
                            <strong>{images.length}</strong> image(s) loaded
                            from <strong>{totalRecords}</strong> records
                        </div>
                    )}
                    {loadStatus === "no results" && (
                        <div className="alert alert-warning">No images are available for this search.</div>
                    )}
                    {loadStatus === "error" && (
                        <div className="alert alert-error">An error occurred.</div>
                    )}
                    {loadStatus === "timeout" && (
                        <div className="alert alert-error">The search timed out.</div>
                    )}
                    <div ref={imageContainerRef}>
                        {images.map((img, idx) => (
                            <div className="imgCon" key={idx}>
                                <a href={img.largeImageViewerUrl}>
                                    <img
                                        src={img.smallImageUrl}
                                        data-width={img.thumbWidth}
                                        data-height={img.thumbHeight}
                                        alt={img.scientificName}
                                        onError={e => (e.currentTarget.src = missingImage)}
                                    />
                                </a>
                                <div className="meta brief">
                                    <ul className="unstyled pull-left" style={{margin: 0}}>
                                        <li className="title">{img.scientificName}</li>
                                    </ul>
                                </div>
                                <div className="meta full hover-target">
                                    <ul className="unstyled pull-left" style={{margin: 0}}>
                                        <li className="title">{img.scientificName}</li>
                                        {img.vernacularName && <li>{img.vernacularName}</li>}
                                        {img.typeStatus && <li>{img.typeStatus}</li>}
                                    </ul>
                                    <span className="pull-right" style={{position: "absolute", bottom: 4, right: 4}}>
                                                <a href={img.recordLink}><i className="bi bi-info-circle"></i></a>
                                                <a href={img.largeImageViewerUrl}><i className="bi bi-zoom-in"></i></a>
                                            </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{textAlign: "center", marginTop: 15}}>
                        {loadStatus === "loading" && <>Loading...</>}
                        {offset + pageSize < totalRecords && loadStatus !== "loading" && (
                            <span className="btn clickable" onClick={onShowMoreResults}>Show more results</span>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default Browse;
