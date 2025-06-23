/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn, TileImage} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';
import capitalise from "../../../helpers/Capitalise.ts";
import {FadeInImage} from "../../common-ui/fadeInImage.tsx";

export const environmentallayersDefn: GenericViewProps = {
    fq: "idxtype:LAYER",

    sortByDate: true,

    facetDefinitions: {
        "type": {
            label: "Type", // redundant, this is overridden below
            order: 1,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with reverse alpha sorting
                var items: any[] = []
                facet.fieldResult.forEach((status: any) => {
                    var fq = facet.fieldName + ":\"" + status.label + "\"";
                    items.push({
                        fq: fq,
                        label: capitalise(status.label),
                        count: status.count,
                        depth: 0
                    })
                })
                if (items.length > 0) {
                    // reverse sort by label
                    items.sort((a: any, b: any) => {
                        return b.label.localeCompare(a.label)
                    })

                    facetList.push({
                        name: "Type",
                        items: items,
                        order: 1
                    })
                }
            }
        },
        "classification": {
            label: "Classification", // redundant, this is overridden below
            order: 2,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom label and indentation (depth)
                var items: any [] = []
                var parentCounts: { [key: string]: number } = {}
                facet.fieldResult.forEach((status: any) => {
                    // only 2 categories, so get the actual count for the category
                    var category1 = status.label.split("|")[0]
                    var category2 = status.label.includes("|") ? status.label.split("|")[1] : undefined
                    var cat1Count = parentCounts[category1] || 0
                    parentCounts[category1] = cat1Count + status.count

                    // add only secondary categories, primary categories will be added at the end with a different fq
                    if (category2) {
                        var fq = facet.fieldName + ":\"" + status.label + "\"";
                        items.push({
                            fq: fq,
                            label: status.label, // keep the aggregated category name for sorting
                            count: status.count,
                            depth: 1
                        })
                    }
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
                    // sort by label,
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
                        name: "Classification",
                        items: items,
                        order: 1
                    })
                }
            }
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements : RenderItemElements = {
            image: <FadeInImage
                className={classes.listItemImage}
                src={item.image || missingImage}
                missingImage={missingImage}
            />,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                <span className={classes.overflowText} title={item.keywords}>{item.keywords}</span>
                <span className={classes.multilineText} title={item.source}>{item.source}</span>
            </>,
            description: <>
                <span className={classes.listDescription} title={item.description}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openUrl(import.meta.env.VITE_SPATIAL_URL + "?layers=" + item.guid.split('/').pop())
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: "8px"}}>{item.name}</span>
                {item.keywords &&
                    <span className={classes.overflowText} title={item.keywords}>{item.keywords}</span>}
                {item.source && <span title={item.source} className={classes.overflowText}>{item.source}</span>}
                {item.description &&
                    <span style={{ marginTop: "13px"}} className={classes.listDescription} title={item.description}>{item.description}</span>}
            </>,
            clickFn: () => openUrl(import.meta.env.VITE_SPATIAL_URL + "?layers=" + item.guid.split('/').pop())
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: "Spatial layers",
            url: import.meta.env.VITE_SPATIAL_URL + "/ws/layers/index"
        }
    ]
}
