import {CustomFacetFn, GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Box, Flex, Image, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {FolderIcon} from "@atlasoflivingaustralia/ala-mantine";
import {limitDescription, openUrl} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';

export const datasetsDefn: GenericViewProps = {
    // TODO: awaiting clarification if the fq should instead be: idxtype:DATARESOURCE OR idxtype:DATAPROVIDER OR idxtype:COLLECTION OR idxtype:INSTITUTION
    fq: "idxtype:DATARESOURCE",

    sortByDate: true,

    facetDefinitions: {
        "resourceType": {
            label: "Dataset Type",
            order: 1
        },
        "license": {
            label: "Licence Type",
            order: 2
        },
        "dataProvider": {
            label: "Data Provider",
            order: 3
        },
        "state": {
            label: "State/Territory",
            order: 4
        }
    },

    renderListItemFn: ({item, wide}: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
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
            <Box className={classes.desktop}>
                <div style={{minWidth: wide ? "250px" : "210px", maxWidth: wide ? "250px" : "210px"}}>
                    <Text className={classes.listItemName}>{item.name}</Text>
                </div>
                <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                    <Text><FolderIcon color="#637073"/> contains {item.occurrenceCount} occurrence records</Text>
                </div>
                <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                    <Text title={item.description}>{limitDescription(item.description, wide ? 230 : 120)}</Text>
                </div>
            </Box>

            <Box className={classes.mobile}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Space h="8px"/>
                <Text fz={14}><FolderIcon color="#637073"/> contains {item.occurrenceCount} records</Text>
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </Box>
        </Flex>
    },

    renderTileItemFn: ({item}: RenderItemParams) => {
        return <div className={classes.tile} onClick={() => openUrl(item.guid)}>
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
                <Text fz={14}><FolderIcon color="#637073"/> contains {item.occurrenceCount} occurrence records</Text>
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </div>
    },

    addCustomFacetsFn: ({url, thisFacetFqs, parentData, setCustomFacetData}: CustomFacetFn) => {
        fetch(url + "&fq=occurrenceCount:0").then(response => response.json()).then(data => {
            var items = []
            if (parentData.totalRecords - data.totalRecords > 0) {
                items.push({
                    fq: "-occurrenceCount:0 AND occurrenceCount:*", // TODO: support range queries in /v2/search
                    label: "Yes",
                    count: parentData.totalRecords - data.totalRecords,
                    depth: 0,
                    selected: thisFacetFqs.includes("-occurrenceCount:0 AND occurrenceCount:*")
                })
            }
            if (data.totalRecords > 0) {
                items.push({
                    fq: "occurrenceCount:0",
                    label: "Metadata only",
                    count: data.totalRecords,
                    depth: 0,
                    selected: thisFacetFqs.includes("occurrenceCount:0")
                })
            }
            if (items.length > 0) {
                setCustomFacetData([{
                    name: "Contains records",
                    items: items,
                    order: 5
                }])
            } else {
                setCustomFacetData([])
            }
        });
    }
}
