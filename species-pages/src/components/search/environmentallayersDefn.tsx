
import {GenericViewProps, RenderItemParams} from "../../api/sources/model.ts";
import {Flex, Image, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {limitDescription, openUrl} from "./util.tsx";

export const environmentallayersDefn: GenericViewProps = {
    fq: "idxtype:LAYER",

    facetDefinitions: {
        "type": {
            label: "Spatial layer type"
        }
        // TODO: add a custom facet for the aggregation of classification1 and classification2 and use it here
    },

    renderListItemFn: ({ item }: RenderItemParams) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.overflowText} title={item.keywords}>{item.keywords}</Text>
                <Text title={item.source}>{item.source}</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({ item }: RenderItemParams) => {
        return <div className={classes.tile} onClick={() => openUrl(item.guid)}>
            {item.image && <Image height={150} width="auto"
                                  src={item.image}
                                  onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
            />
            }
            {!item.image && <Image height={150} width="auto"
                                   src="../../../public/missing-image.png"
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
                    <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>}
            </div>
        </div>
    }
}
