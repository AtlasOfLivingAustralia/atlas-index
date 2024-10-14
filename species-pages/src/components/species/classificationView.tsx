import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Flex, Grid, Notification, Skeleton, Space, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";
import classes from "./species.module.css";
import FormatName from "../nameUtils/formatName.tsx";

interface ViewProps {
    result?: Record<PropertyKey, string | number | any >
}

function ClassificationView({result}: ViewProps) {
    const [children, setChildren] = useState<any[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [loading] = useState<boolean>(false);
    const [errorMessage] = useState<string>('');

    useEffect(() => {
        if (result?.guid) {
            fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=idxtype:TAXON&fq=-acceptedConceptID:*&fq=parentGuid:\"" + encodeURIComponent(result.guid) + "\"").then(response => response.json()).then(data => {
                data.searchResults.sort((a: any, b: any) => (a.nameComplete < b.nameComplete ? -1 : (a.nameComplete > b.nameComplete ? 1 : 0)))
                setChildren(data.searchResults)
            })
        }
        if (result?.rankOrder) {
            let items: Record<PropertyKey, string | number | any >[] = []
            for (let rank of result.rankOrder.split(',')) {
                var rankString = rank.replace(/[0-9]/g, ' ') // remove the suffix number that is used to handle duplicates
                items = [{rank: rankString, name: result['rk_' + rank], guid: result['rkid_' + rank]}, ...items]
            }
            items.push({rank: result.rank, name: result.name, guid: result.guid})
            setHierarchy(items)
        }
    }, [result]);


    function capitalize(rank: string) {
        // capitalize first letter
        return rank.charAt(0).toUpperCase() + rank.slice(1);
    }

    return (
        <Grid>
            <Grid.Col span={9}>
                { loading &&
                    <Skeleton height={40} />
                }
                { !errorMessage && !loading && hierarchy.length === 0 && <>
                        {/* TODO: this is needed only for kingdom records. They do not currently have hierarchy information */}
                            <Flex
                                data-guid={result?.guid}
                                className={ classes.currentTaxa }
                                style={{
                                    borderRadius: "4px",
                                }}
                                mb="3px"
                            >
                                <Text miw={110} pl="md" fw="bold">{capitalize(result?.rank)}</Text>
                                <Anchor component={Link} to={`/species?id=${result?.guid}`}><FormatName name={result?.scientificName} rankId={result?.rankID}/></Anchor>
                            </Flex>
                    </>
                }
                { hierarchy && hierarchy.map((item, idx) =>
                    <Flex
                        key={idx}
                        data-guid={item.guid}
                        className={ idx === hierarchy.length -1 ? classes.currentTaxa : "" }
                        style={{
                            marginLeft: (idx * 20) + "px",
                            borderRadius: "4px",
                        }}
                        mb="3px"
                    >
                        <Text miw={110} pl="md" fw="bold">{capitalize(item.rank)}</Text>
                        <Anchor component={Link} to={`/species?id=${item.guid}`} pl="sm"><FormatName name={item.name} rankId={item.rankID}/></Anchor>
                    </Flex>
                )}
                { children && children.map((child, idx) =>
                    <Flex
                        key={idx}
                        style={{
                            marginLeft: (hierarchy.length * 20 + 1) + "px"
                        }}
                    >
                        <Text miw={110} pl="md" fw="bold">{capitalize(child.rank)}</Text>
                        <Anchor component={Link} to={`/species?id=${child.guid}`} pl="sm"><FormatName name={child.nameComplete} rankId={child.rankID}/></Anchor>
                    </Flex>
                )}
                { errorMessage &&
                    <Notification
                        withBorder
                        title="Error loading classification"
                    >
                        {errorMessage}
                    </Notification>
                }
            </Grid.Col>
            <Grid.Col span={3}>
                <Flex justify="flex-start" align="center" gap="5px">
                    <IconInfoCircleFilled size={18}/>
                    <Text fw={800} fz={16}>About classification</Text>
                </Flex>
                <Space h="px10" />
                <Text>
                    Classification of organisms allows us to group them and imply how they are related to each other.
                    This includes a hierarchy of ranks e.g. kingdom, phylum etc. for more information see{" "}
                    <Anchor inherit target="_blank" href={import.meta.env.VITE_TAXONOMY_INTRO_URL}>An introduction to taxonomy</Anchor>
                </Text>
            </Grid.Col>
        </Grid>
    )
}

export default ClassificationView;
