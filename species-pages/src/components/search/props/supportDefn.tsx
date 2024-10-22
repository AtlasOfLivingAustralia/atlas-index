import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {limitDescription, openUrl} from "../util.tsx";

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
            label: "Webpage type",
            order: 1,
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
                        name: "Webpage type",
                        items: items,
                        order: 1
                    })
                }
            }
        }
    },

    renderListItemFn: ({item, wide}: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: wide ? "342px" : "300px", maxWidth: wide ? "342px" : "300px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                {item.classification1 && <Text>{item.classification1}</Text>}
                {item.classification2 && <Text>{item.classification2}</Text>}
            </div>
            <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                <Text title={item.description}>{limitDescription(item.description, wide ? 230 : 120)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({item}: RenderItemParams) => {
        return <div className={classes.tileNoImage} onClick={() => openUrl(item.guid)}>
            <div className={classes.tileContent}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Space h="8px"/>
                {item.classification1 && <Text fz={14}>{formatWordpressCategory(item.classification1)}</Text>}
                {item.classification2 && <Text fz={14}>{formatWordpressCategory(item.classification2)}</Text>}
                <Space h="13px"/>
                {item.description &&
                    <Text fz={14} title={item.description}>{item.description}</Text>}
            </div>
        </div>
    }
}
