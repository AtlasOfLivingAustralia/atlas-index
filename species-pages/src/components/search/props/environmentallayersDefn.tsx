import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Image, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {limitDescription, openUrl} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';

export const environmentallayersDefn: GenericViewProps = {
    fq: "idxtype:LAYER",

    sortByDate: true,

    facetDefinitions: {
        "classification": {
            label: "Classification",
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
        },
        "type": {
            label: "Spatial layer type",
            order: 2
        }
    },

    renderListItemFn: ({item, wide}: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openUrl(import.meta.env.VITE_SPATIAL_URL + "?layers=" + item.guid.split('/').pop())}
                     style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = missingImage}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src={missingImage}
                    />
                }
            </div>
            <div style={{minWidth: wide ? "250px" : "210px", maxWidth: wide ? "250px" : "210px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                <Text className={classes.overflowText} title={item.keywords}>{item.keywords}</Text>
                <Text title={item.source}>{item.source}</Text>
            </div>
            <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                <Text title={item.description}>{limitDescription(item.description, wide ? 230 : 120)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({item}: RenderItemParams) => {
        return <div className={classes.tile} onClick={() => openUrl(import.meta.env.VITE_SPATIAL_URL + "?layers=" + item.guid.split('/').pop())}>
            {item.image && <Image height={150} width="auto"
                                  src={item.image}
                                  onError={(e) => e.currentTarget.src = missingImage}
            />
            }
            {!item.image && <Image height={150} width="auto"
                                   src={missingImage}
            />
            }

            <div className={classes.tileContent}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Space h="8px"/>
                {item.keywords &&
                    <Text fz={14} className={classes.overflowText} title={item.keywords}>{item.keywords}</Text>}
                {item.source && <Text fz={14} title={item.source}>{item.source}</Text>}
                <Space h="13px"/>
                {item.description &&
                    <Text fz={14} title={item.description}>{item.description}</Text>}
            </div>
        </div>
    }
}
