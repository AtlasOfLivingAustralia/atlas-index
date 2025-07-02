/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn} from "../util.tsx";

function formatCategory(category: string) {
    if (category == "REGION") {
        return "Region";
    } else {
        return "Locality";
    }
}

function openRegionLocality(item: any) {
    // idxtype:LOCALITY opens expore your area
    // idxtype:REGION opens spatial portal, because regions does not have a landing page for a pid

    var parts = item.description.split(" ");
    if (item.idxtype == "LOCALITY" && parts.length == 3) {
        var lat = parts[parts.length - 2];
        var lng = parts[parts.length - 1];
        openUrl(import.meta.env.VITE_BIOCACHE_UI_URL + "/explore/your-area#" + lat + "|" + lng + "|12|ALL_SPECIES");
        return;
    } else {
        // id is of the form "fid-pid", get the pid
        openUrl(import.meta.env.VITE_REGIONS_URL + `/region?id=${item.id.split('-')[1]}`); // new regions app
        return;
    }
}

export const regionslocalitiesDefn: GenericViewProps = {
    fq: "idxtype:REGION OR idxtype:LOCALITY",

    sortByDate: true,

    facetDefinitions: {
        "idxtype": {
            label: "Type", // redundant, this is overridden below
            order: 1,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom label
                var items: any [] = []
                facet.fieldResult.forEach((status: any) => {
                    var fq = facet.fieldName + ":\"" + status.label + "\"";
                    items.push({
                        fq: fq,
                        label: formatCategory(status.label),
                        count: status.count,
                        depth: 0
                    })
                })
                if (items.length > 0) {
                    // sort by label
                    items.sort((a: any, b: any) => {
                        return a.label.localeCompare(b.label);
                    })

                    facetList.push({
                        name: "Type",
                        items: items,
                        order: 1
                    })
                }
            }
        },
        "fieldName": {
            label: "Source",
            order: 2
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements : RenderItemElements = {
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                <span className={classes.listItemText}>{item.fieldName}</span>
                <span className={classes.multilineText}>Type {item.idxtype == "LOCALITY" ? "Locality" : "Region / Area"}</span>
            </>,
            description: <>
                <span className={classes.listDescription} title={item.description}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openRegionLocality(item)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            title: <>
                <span className={classes.listItemName} style={{marginBottom: "8px"}}>{item.name}</span>
                <span className={classes.listItemText}>{item.fieldName}</span>
                <span className={classes.listItemText}>Type {item.idxtype == "LOCALITY" ? "Locality" : "Region / Area"}</span>
                <span style={{ marginTop: "13px"}} className={classes.listDescription} title={item.description}>{item.description}</span>
            </>,
            clickFn: () => openRegionLocality(item)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: "Explore your area",
            url: import.meta.env.VITE_BIOCACHE_UI_URL + "/explore/your-area"
        },
        {
            label: "Regions",
            url: import.meta.env.VITE_REGIONS_URL
        }
    ]
}
