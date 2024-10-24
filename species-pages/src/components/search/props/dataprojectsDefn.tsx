import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Image, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {limitDescription, openUrl} from "../util.tsx";

export const dataprojectsDefn: GenericViewProps = {
    fq: "idxtype:BIOCOLLECT",

    sortByDate: true,

    facetDefinitions: {
        "projectType": {
            label: "Project type",
            order: 1
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
            <div style={{minWidth: wide ? "250px" : "210px", maxWidth: wide ? "250px" : "210px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: wide ? "250px" : "200px", maxWidth: wide ? "250px" : "200px"}}>
                {/*<Text><FolderIcon color="#637073"/> contains {item.occurrenceCount} records</Text>*/}
            </div>
            <div style={{minWidth: wide ? "550px" : "340px", maxWidth: wide ? "550px" : "340px"}}>
                <Text title={item.description}>{limitDescription(item.description, wide ? 230 : 120)}</Text>
            </div>
        </Flex>
    },

    renderTileItemFn: ({item}: RenderItemParams) => {
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
