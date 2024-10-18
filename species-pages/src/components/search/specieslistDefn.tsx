
import {GenericViewProps, RenderItemParams} from "../../api/sources/model.ts";
import {Flex, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {FolderIcon} from "@atlasoflivingaustralia/ala-mantine";
import {limitDescription, openUrl} from "./util.tsx";

function formatListType(type: string) {
    if (!type) {
        return type;
    }
    return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export const specieslistDefn: GenericViewProps = {
    fq: "idxtype:SPECIESLIST",

    facetDefinitions: {
        "type": {
            label: "Species list",
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
                        items: items
                    })
                }
            }
        }
    },

    renderListItemFn: ({ item }: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "342px", maxWidth: "342px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Text>{formatListType(item.type)}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text><FolderIcon color="#637073"/> contains {item.itemCount} taxa</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({ item }: RenderItemParams) => {
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
