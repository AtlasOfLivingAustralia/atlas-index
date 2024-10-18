
import {GenericViewProps, RenderItemParams} from "../../api/sources/model.ts";
import {Flex, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {limitDescription, openUrl} from "./util.tsx";

function formatCategory(category: string) {
    if (category == "REGION") {
        return "Region / Area";
    } else {
        return "Locality";
    }
}

function openRegionLocality(pid: string, description: string) {
    // test description, if it ends with "latitude longitude" then open explore your area
    // otherwise, open regions.ala.org.au with the pid, or at least try to.
    console.log("openRegionLocality", pid, description);
}

export const regionslocalitiesDefn: GenericViewProps = {
    fq: "idxtype:REGION OR idxtype:LOCALITY",

    facetDefinitions: {
        "idxtype": {
            label: "Primary category",
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
                        name: "Species list",
                        items: items
                    })
                }
            }
        },
        "fieldName": {
            label: "Region Type"
        },
    },

    renderListItemFn: ({ item }: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openRegionLocality(item.pid, item.description)}
                     style={{cursor: "pointer"}}>
            <div style={{minWidth: "342px", maxWidth: "342px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text>{item.fieldName}</Text>
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
                <Text fz={14}>{item.fieldName}</Text>
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </div>
    }
}
