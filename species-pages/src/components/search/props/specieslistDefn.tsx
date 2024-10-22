import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {FolderIcon} from "@atlasoflivingaustralia/ala-mantine";
import {limitDescription, openUrl} from "../util.tsx";

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
            label: "Species list",
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
                        name: "Species list",
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
                <Text>{formatListType(item.type)}</Text>
            </div>
            <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                <Text><FolderIcon color="#637073"/> contains {item.itemCount} taxa</Text>
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
                <Text fz={14}>{formatListType(item.type)}</Text>
                <Text fz={14}><FolderIcon color="#637073"/> contains {item.itemCount} taxa</Text>
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </div>
    }
}
