
import {GenericViewProps, RenderItemParams} from "../../api/sources/model.ts";
import {Flex, Image, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {limitDescription, openUrl} from "./util.tsx";

export const dataprojectsDefn: GenericViewProps = {
    fq: "idxtype:BIOCOLLECT",

    facetDefinitions: {
        "projectType": {
            label: "Project type"
        }
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
                {/*<Text><FolderIcon color="#637073"/> contains {item.occurrenceCount} records</Text>*/}
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
                <Space h="13px"/>
                <Text fz={14} title={item.description}>{limitDescription(item.description, 230)}</Text>
            </div>
        </div>
    }
}
