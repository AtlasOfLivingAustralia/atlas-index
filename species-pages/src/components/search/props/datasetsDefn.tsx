/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {CustomFacetFn, GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {
    limitDescription,
    openUrl,
    renderGenericListItemFn,
    renderGenericTileItemFn, TileImage
} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';
import FolderIcon from "../../common-ui/icons/folderIcon.tsx";
import {FadeInImage} from "../../common-ui/fadeInImage.tsx";
import capitalise from "../../../helpers/Capitalise.ts";

const idxtypeLabels: Record<string, string> = {
    "DATARESOURCE": "Data Resource",
    "DATAPROVIDER": "Data Provider",
    "COLLECTION": "Collection",
    "INSTITUTION": "Institution"
};

export const datasetsDefn: GenericViewProps = {
    fq: "idxtype:DATARESOURCE OR idxtype:DATAPROVIDER OR idxtype:COLLECTION OR idxtype:INSTITUTION",

    sortByDate: true,

    customFacets: ["idxtype", "resourceType"],

    facetDefinitions: {
        "license": {
            label: "Licence type",
            order: 3
        },
        "state": {
            label: "State/Territory",
            order: 4
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <FadeInImage
                className={classes.listItemImage}
                src={item.image || missingImage}
                missingImage={missingImage}
            />,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                <span className={classes.listItemText}><FolderIcon/> contains {item.occurrenceCount} occurrence records</span>
            </>,
            description: <>
                <span title={item.description}
                      className={classes.listDescription}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
                <span style={{marginTop: "8px", marginBottom: "13px"}}
                      className={classes.overflowText}><FolderIcon/> contains {item.occurrenceCount} occurrence records</span>
                <span title={item.description}
                      className={classes.listDescription}>{item.description}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    addCustomFacetsFn: ({url, thisFacetFqs, parentData, setCustomFacetData}: CustomFacetFn) => {
        // 1. Add a custom facet for the "Type" of dataset from idxtype and resourceType fields
        var typeFacet = {};
        var idxtypeFacet: any = Object.values(parentData.facetResults).find(
            (f: any) => f.fieldName === "idxtype"
        );
        var resourceTypeFacet: any = Object.values(parentData.facetResults).find(
            (f: any) => f.fieldName === "resourceType"
        );
        var resourceTypeItems: any[] = [];
        if (resourceTypeFacet) {
            resourceTypeFacet.fieldResult.forEach((status: any) => {
                var fq = "resourceType:\"" + status.label + "\"";
                resourceTypeItems.push({
                    fq: fq,
                    label: capitalise(status.label),
                    count: status.count,
                    depth: 1,
                    selected: thisFacetFqs.includes(fq)
                });
            });
            // sort by label
            resourceTypeItems.sort((a: any, b: any) => {
                return a.label.localeCompare(b.label);
            });
        }
        var typeItems: any[] = [];
        if (idxtypeFacet) {
            idxtypeFacet.fieldResult.forEach((status: any) => {
                var fq = "idxtype:\"" + status.label + "\"";
                typeItems.push({
                    fq: fq,
                    label: idxtypeLabels[status.label] || capitalise(status.label),
                    count: status.count,
                    depth: 0,
                    selected: thisFacetFqs.includes(fq)
                });
            });
            // sort by label
            typeItems.sort((a: any, b: any) => {
                return a.label.localeCompare(b.label);
            });
            // insert resourceType items into typeItems after DATARESOURCE
            var dataResourceIndex = typeItems.findIndex((item: any) => item.label == idxtypeLabels["DATARESOURCE"]);
            if (dataResourceIndex >= 0) {
                typeItems.splice(dataResourceIndex + 1, 0, ...resourceTypeItems);
            }
        }
        if (typeItems.length > 0) {
            typeFacet = {
                name: "Type",
                items: typeItems,
                order: 1
            };
        }

        // 2. Add "Contains records" facet, for filtering datasets with and without occurrence records
        fetch(url + "&fq=occurrenceCount:0").then(response => response.json()).then(data => {
            var items = []
            if (parentData.totalRecords - data.totalRecords > 0) {
                items.push({
                    fq: "-occurrenceCount:0 AND occurrenceCount:*", // TODO: support range queries in /v2/search
                    label: "Yes",
                    count: parentData.totalRecords - data.totalRecords,
                    depth: 0,
                    selected: thisFacetFqs.includes("-occurrenceCount:0 AND occurrenceCount:*")
                })
            }
            if (data.totalRecords > 0) {
                items.push({
                    fq: "occurrenceCount:0",
                    label: "Metadata only",
                    count: data.totalRecords,
                    depth: 0,
                    selected: thisFacetFqs.includes("occurrenceCount:0")
                })
            }
            if (items.length > 0) {
                setCustomFacetData([{
                    name: "Contains records",
                    items: items,
                    order: 2
                }, typeFacet])
            } else {
                setCustomFacetData([typeFacet]);
            }
        });
    },

    resourceLinks: [
        {
            label: "Collectory",
            url: import.meta.env.VITE_COLLECTIONS_URL
        }
    ]
}
