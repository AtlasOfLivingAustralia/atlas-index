import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Anchor, Flex, Grid, Skeleton, Space, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";
import classes from "./species.module.css";
import { FlagIcon } from '@atlasoflivingaustralia/ala-mantine';

import '../../css/nameFormatting.css';

interface ViewProps {
    result?: Record<PropertyKey, string | number | any >
}

function ClassificationView({result}: ViewProps) {
    const [children, setChildren] = useState<any[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (result?.guid) {
            fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=idxtype:TAXON&fq=-acceptedConceptID:*&fq=parentGuid:\"" + encodeURIComponent(result.guid) + "\"")
                .then(response => response.json())
                .then(data => {
                    if (data?.searchResults) {
                        data.searchResults.sort((a: any, b: any) => (a.nameComplete < b.nameComplete ? -1 : (a.nameComplete > b.nameComplete ? 1 : 0)))
                        setChildren(data.searchResults)
                    } else if (data?.status != 200 && data?.error) {
                        // Not sure why a 404 will end up here instead of the catch
                        setErrorMessage(data.error)
                    }
                }).catch((error) => {
                    setErrorMessage(error)
                }).finally(() => {
                    setLoading(false)
                });
        }
        if (result?.rankOrder) {
            let items: Record<PropertyKey, string | number | any >[] = []
            for (let rank of result.rankOrder.split(',')) {
                var rankString = rank.replace(/[0-9]/g, ' ') // remove the suffix number that is used to handle duplicates
                items = [{rank: rankString, name: result['rkf_' + rank], guid: result['rkid_' + rank]}, ...items]
            }
            items.push({rank: result.rank, name: result.nameFormatted, guid: result.guid})
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
                { /* the choice made here is to display all of the hierarchy at once, rather than parents and children separately */}
                { loading && <Skeleton height={40} width="90%" radius="md" />}
                { !loading && hierarchy.length === 0 && <>
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
                                <Anchor component={Link} to={`/species/${result?.guid}?tab=classification`}
                                    dangerouslySetInnerHTML={{__html: result?.nameFormatted}}></Anchor>
                            </Flex>
                    </>
                }
                { !loading && hierarchy && hierarchy.map((item, idx) =>
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
                        <Anchor component={Link} to={`/species/${item.guid}?tab=classification`} pl="sm"
                            dangerouslySetInnerHTML={{__html: item.name}}
                            ></Anchor>
                    </Flex>
                )}
                { children && children.map((child, idx) =>
                    <Flex
                        key={idx}
                        style={{
                            marginLeft: (Math.max(1, hierarchy.length) * 20 + 1) + "px"
                        }}
                    >
                        <Text miw={110} pl="md" fw="bold">{capitalize(child.rank)}</Text>
                        <Anchor component={Link} to={`/species/${child.guid}?tab=classification`} pl="sm"
                            dangerouslySetInnerHTML={{__html: child.nameFormatted}}
                        ></Anchor>
                    </Flex>
                )}
                { errorMessage &&
                    <Alert icon={<FlagIcon />}>
                        <b>Error loading child taxa.</b>
                        <p>Report this error by clicking on the <b>Need Help?</b> button on the right edge of the screen.</p>
                        <code>{errorMessage}</code>
                    </Alert>
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
