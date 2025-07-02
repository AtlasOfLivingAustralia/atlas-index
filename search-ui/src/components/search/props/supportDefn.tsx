/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn} from "../util.tsx";

function formatWordpressCategory(category: string) {
    if (!category) {
        return category;
    }
    return category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export const supportDefn: GenericViewProps = {
    fq: "idxtype:KNOWLEDGEBASE",

    sortByDate: true,

    facetDefinitions: {
        "classification": {
            label: "Type", // redundant, this is overridden below
            order: 1,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom label and indentation (depth)
                var items: any [] = []
                var parentCounts: { [key: string]: number } = {}
                facet.fieldResult.forEach((status: any) => {
                    // only 2 categories, so get the actual count for the category
                    var category1 = status.label.split("|")[0]
                    var cat1Count = parentCounts[category1] || 0
                    parentCounts[category1] = cat1Count + status.count

                    // if we wanted the second level of categories, we would comment this code, I feel bad about deleting
                    // it now that a change of requirements arrived and I am not sure I would remember how to get it back
                    // should the decision be reverted.

                    // // add only secondary categories, primary categories will be added at the end with a different fq
                    // var category2 = status.label.includes("|") ? status.label.split("|")[1] : undefined
                    // if (category2) {
                    //     var fq = facet.fieldName + ":\"" + status.label + "\"";
                    //     items.push({
                    //         fq: fq,
                    //         label: status.label, // keep the aggregated category name for sorting
                    //         count: status.count,
                    //         depth: 1
                    //     })
                    // }
                })

                // add primary categories for each parentCount
                for (var category in parentCounts) {
                    var fq = "classification1:\"" + category + "\"";
                    items.push({
                        fq: fq,
                        label: category,
                        count: parentCounts[category],
                        depth: 0
                    })
                }

                if (items.length > 0) {
                    // sort by label
                    items.sort((a: any, b: any) => {
                        return a.label.localeCompare(b.label);
                    })

                    // remove the primary category from secondary categories labels
                    items.forEach((item: any) => {
                        if (item.depth === 1) {
                            item.label = item.label.split("|")[1]
                        }
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

    renderListItemFn: ({item, navigate, wide,isMobile}: RenderItemParams) => {
        const elements : RenderItemElements = {
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                {item.classification1 && <span className={classes.overflowText}>{item.classification1}</span>}
                {item.classification2 && <span className={classes.overflowText}>{item.classification2}</span>}
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
                {item.classification1 && <span className={classes.listItemText}>{formatWordpressCategory(item.classification1)}</span>}
                {item.classification2 && <span className={classes.listItemText}>{formatWordpressCategory(item.classification2)}</span>}
                {item.description &&
                    <span style={{marginTop: "13px"}} className={classes.listDescription} title={item.description}>{item.description}</span>}
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: "Knowledge Base",
            url: import.meta.env.VITE_APP_KNOWLEDGE_BASE_URL
        }
    ]
}
