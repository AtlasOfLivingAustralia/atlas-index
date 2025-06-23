/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn} from "../util.tsx";
import FolderIcon from "../../common-ui/icons/folderIcon.tsx";

function formatListType(type: string) {
    if (!type) {
        return type;
    }
    return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export const specieslistDefn: GenericViewProps = {
    fq: "idxtype:SPECIESLIST",

    sortByDate: true,

    facetDefinitions: {
        "type": {
            label: "Type", // redundant, this is overridden below
            order: 1,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom label
                var items: any [] = []
                facet.fieldResult.forEach((status: any) => {
                    var fq = facet.fieldName + ":\"" + status.label + "\"";
                    items.push({
                        fq: fq,
                        label: formatListType(status.label),
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
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements : RenderItemElements = {
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
                <span className={classes.multilineText}>{formatListType(item.type)}</span>
            </>,
            extra: <>
                <span className={classes.multilineText}><FolderIcon/> contains {item.itemCount} taxa</span>
            </>,
            description: <>
                <span className={classes.listDescription} title={item.description}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            title: <>
                <span className={classes.listItemName} style={{marginBottom: "8px"}}>{item.name}</span>
                <span className={classes.listItemText}>{formatListType(item.type)}</span>
                <span className={classes.listItemText}><FolderIcon /> contains {item.itemCount} taxa</span>
                <span style={{marginTop: "13px"}} className={classes.listDescription} title={item.description}>{item.description}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: "Species lists",
            url: import.meta.env.VITE_SPECIESLIST_URL
        }
    ]
}
