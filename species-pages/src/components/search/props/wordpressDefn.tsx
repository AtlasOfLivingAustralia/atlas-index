import {GenericViewProps, RenderItemParams} from "../../../api/sources/model.ts";
import {Flex, Image, Space, Text} from "@mantine/core";
import classes from "../search.module.css";
import {limitDescription, openUrl} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';

export const wordpressDefn: GenericViewProps = {
    fq: "idxtype:WORDPRESS",

    sortByDate: true,

    facetDefinitions: {
        "classification1": {
            label: "Webpage type",
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
                <Text>{item.classification1}</Text>
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
                {item.classification1 && <Text fz={14}>{item.classification1}</Text>}
                <Space h="13px"/>
                {item.description &&
                    <Text fz={14} title={item.description}>{item.description}</Text>}
            </div>
        </div>
    }
}
