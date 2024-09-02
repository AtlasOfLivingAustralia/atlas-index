import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Flex, Grid, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";

interface ViewProps {
    result?: Record<PropertyKey, string | number | any >
}

function ClassificationView({result}: ViewProps) {
    const [children, setChildren] = useState<any[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);

    useEffect(() => {
        if (result?.guid) {
            fetch("http://localhost:8081/v1/search?q=idxtype:TAXON&fq=-acceptedConceptID:*&fq=parentGuid:\"" + encodeURIComponent(result.guid) + "\"").then(response => response.json()).then(data => {
                data.searchResults.sort((a, b) => (a.nameComplete < b.nameComplete ? -1 : (a.nameComplete > b.nameComplete ? 1 : 0)))
                setChildren(data.searchResults)
            })
        }
        if (result?.rankOrder) {
            let items: Record<PropertyKey, string | number | any >[] = []
            for (let rank of result.rankOrder.split(',')) {
                items = [{rank: rank, name: result['rk_' + rank], guid: result['rkid_' + rank]}, ...items]
            }
            items.push({rank: result.rank, name: result.name, guid: result.guid})
            setHierarchy(items)
        }
    }, [result]);


    function capitalize(rank: string) {
        // capitalize first letter
        return rank.charAt(0).toUpperCase() + rank.slice(1);
    }

    return <>
        <Grid>
            <Grid.Col span={9}>
                { hierarchy && hierarchy.map((item, idx) =>
                    <Flex 
                        key={idx} 
                        data-guid={item.guid}
                        className="taxa" 
                        style={{
                            marginLeft: (idx * 20) + "px",
                            backgroundColor:  idx < hierarchy.length - 1 ? "inherit" : "lightgray",
                        }}
                    >
                        <Text miw={110} pl="md" fw="bold">{capitalize(item.rank)}</Text>
                        <Anchor component={Link} to={`/species?id=${item.guid}`}>{item.name}</Anchor>
                    </Flex>
                )}

            { children && children.map((child, idx) =>
                <Flex 
                    key={idx} 
                    // className="taxa" 
                    style={{
                        marginLeft: (hierarchy.length * 20 + 1) + "px"
                    }}
                >
                    <Text miw={110} pl="md" fw="bold">{capitalize(child.rank)}</Text>
                    <Anchor component={Link} to={`/species?id=${child.guid}`} >{child.nameComplete}</Anchor>
                </Flex>
            )}
            </Grid.Col>
            <Grid.Col span={3}>
                <Flex justify="flex-start" align="center" gap="xs">
                    <IconInfoCircleFilled size={24}/>
                    <Text fw={800} fz={16}>About classification</Text>
                </Flex>
                <Text fz={14} mt="sm">
                    Classification of organisms allows us to group them and imply how they are related to each other.
                    This includes a hierarchy of ranks e.g. kingdom, phylum etc. for more information see An introduction to
                    taxonomy
                </Text>
            </Grid.Col>
        </Grid>
    </>
}

export default ClassificationView;
