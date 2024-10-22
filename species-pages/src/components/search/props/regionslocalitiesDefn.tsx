import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {limitDescription, openUrl} from "../util.tsx";

function formatCategory(category: string) {
    if (category == "REGION") {
        return "Region / Area";
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
        openUrl(item.guid);
        return;
    }
}

export const regionslocalitiesDefn: GenericViewProps = {
    fq: "idxtype:REGION OR idxtype:LOCALITY",

    sortByDate: true,

    facetDefinitions: {
        "idxtype": {
            label: "Primary category",
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
                        name: "Primary category",
                        items: items,
                        order: 1
                    })
                }
            }
        },
        "fieldName": {
            label: "Region Type",
            order: 2
        }
    },

    renderListItemFn: ({item, wide}: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openRegionLocality(item)}
                     style={{cursor: "pointer"}}>
            <div style={{minWidth: wide ? "342px" : "300px", maxWidth: wide ? "342px" : "300px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                <Text>{item.fieldName}</Text>
            </div>
            <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                <Text title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({item}: RenderItemParams) => {
        return <div className={classes.tileNoImage} onClick={() => openRegionLocality(item)}>
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
