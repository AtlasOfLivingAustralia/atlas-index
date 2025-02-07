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

function openRegionLocality(item: any, navigate: any) {
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
        navigate(`/region?id=${item.id.split('-')[1]}`);
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

    renderListItemFn: ({item, wide, navigate}: RenderItemParams) => {
        return <>
            <Flex className={classes.desktop} gap="30px" onClick={() => openRegionLocality(item, navigate)}
                         style={{cursor: "pointer"}}>
                <div style={{minWidth: wide ? "342px" : "300px", maxWidth: wide ? "342px" : "300px"}}>
                    <Text className={classes.listItemName}>{item.name}</Text>
                </div>
                <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                    <Text>{item.fieldName}</Text>
                    <Text>Type {item.idxtype == "LOCALITY" ? "Locality" : "Region / Area"}</Text>
                </div>
                <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                    <Text title={item.description}>{limitDescription(item.description, 230)}</Text>
                </div>
            </Flex>

            <Flex className={classes.mobile} direction="column" gap="30px" onClick={() => openRegionLocality(item, navigate)}
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
            </>
    },

    renderTileItemFn: ({item, navigate}: RenderItemParams) => {
        return <div className={classes.tileNoImage} onClick={() => openRegionLocality(item, navigate)}>
            <div className={classes.tileContent}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Space h="8px"/>
                <Text fz={14}>{item.fieldName}</Text>
                <Text fz={14}>Type {item.idxtype == "LOCALITY" ? "Locality" : "Region / Area"}</Text>
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </div>
    }
}
