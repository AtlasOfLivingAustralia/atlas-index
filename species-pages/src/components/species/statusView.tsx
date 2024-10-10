import { ConservationStatus, ConservationStatusKey } from "@atlasoflivingaustralia/ala-mantine";
import { Anchor, Box, Divider, Flex, Grid, Table, Text, Title, Space } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";
import {useEffect, useState} from "react";

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

interface ConservationItem {
    name?: string;
    status?: string;
    iucn?: string;
}

interface NativeIntroducedItem {
    [key: string]: string;
}

const iucnStatusMapping = { "Extinct": "EX", "Extinct in the Wild": "EW", "Critically Endangered" : "CR", "Endangered" : "EN", "Vulnerable" : "VU", "Near Threatened" : "NT", "Least Concern" : "LC" }

// TODO: add validation for the multiple casts of values to ConservationStatusKey

function StatusView({ result }: MapViewProps) {

    const [nativeIntroduced, setNativeIntroduced] = useState<NativeIntroducedItem>({});
    const [conservationStatus, setConservationStatus] = useState<Record<string, ConservationItem>>({});

    useEffect(() => {
        if (result?.native_introduced_s) {
            setNativeIntroduced(JSON.parse(result.native_introduced_s));
        }

        var listNames = result?.listNames;

        var conservation : {[key: string]: ConservationItem} = {};
        result && Object.keys(result).map(key => {
            if (key.startsWith('iucn_')) {
                var listId = key.replace('iucn_', '').replace('_s', ''); // TODO: remove _s after updating elasticsearch mapping to create a pattern for "iucn_*"
                var item : ConservationItem = conservation[listId];
                if (!item) {
                    item = {};
                    conservation[listId] = item;
                }
                item["iucn"] = iucnStatusMapping[result[key] as keyof typeof iucnStatusMapping];
                item["name"] = listNames[listId];
            } else if (key.startsWith('conservation_')) {
                var listId = key.replace('conservation_', '');
                var item : ConservationItem = conservation[listId];
                if (!item) {
                    item = {};
                    conservation[listId] = item;
                }
                item["status"] = result[key];
                item["name"] = listNames[listId];
            }
        });

        if (conservation && Object.keys(conservation).length > 0) {
            console.log("conservation", conservation);
            setConservationStatus(conservation);
        }

    }, []);

    return <>
        <Box>
            {nativeIntroduced && Object.keys(nativeIntroduced).length > 0 &&
                <>
                <Title order={3}>Native / introduced</Title>
                    <Space h="px30" />
                    <Flex justify="flex-start" align="center" gap="xs">
                        <IconInfoCircleFilled size={18}/>
                        <Text fw={800} fz={16}>About native / introduced</Text>
                    </Flex>
                    <Space h="px10" />
                    <Text fz="sm">
                        This indicates if a species is regarded as introduced to Australia, a state, or territory.
                        This can also include Australian native species which have been introduced in areas beyond
                        their natural range, e.g a species native to NSW introduced to WA.&nbsp;
                        <Anchor inherit onClick={(e) => { e.preventDefault(); alert('Requires a URL to be provided'); }}
                            target="_source">Find out more</Anchor>
                    </Text>
                    <Space h="px30" />
                    <Table striped="even">
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Place</Table.Th>
                                <Table.Th>Status</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {Object.keys(nativeIntroduced).sort().map((key, idx) =>
                                <Table.Tr key={idx}>
                                    <Table.Td>{key}</Table.Td>
                                    <Table.Td>{nativeIntroduced[key]}</Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>

                    { conservationStatus &&
                        <>
                            <Space h="px30" />
                            <Divider />
                            <Space h="px30" />
                        </>
                    }
                </>
            }

            { conservationStatus && Object.keys(conservationStatus).length > 0 &&
                <>
                <Title order={3}>Conservation status</Title>
                <Space h="px30" />
                <Table striped="even">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Level</Table.Th>
                            <Table.Th>Source status</Table.Th>
                            <Table.Th>IUCN equivalent class</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {conservationStatus && Object.keys(conservationStatus).sort().map((key: string, idx: number) =>
                            <Table.Tr key={idx}>
                                <Table.Td>{conservationStatus[key].name}</Table.Td>
                                <Table.Td>{conservationStatus[key].status}</Table.Td>
                                <Table.Td>
                                    {conservationStatus[key].iucn &&
                                        <ConservationStatus status={conservationStatus[key].iucn as ConservationStatusKey}/>}
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>

                <Space h="px60" />
                <Flex justify="flex-start" align="center" gap="xs">
                    <IconInfoCircleFilled size={18}/>
                    <Text fw={800} fz={16}>About the IUCN Equivalent Classes</Text>
                </Flex>
                <Space h="px10" />
                <Text fz="sm">
                    As each state and territory have different classifications under their threatened species
                    legislation, the Atlas of Living Australia have interpreted state and territory status
                    classes to align to the equivalent International Union for Conservation of Nature (IUCN) Classes. <Anchor inherit
                        onClick={(e) => { e.preventDefault(); alert('Requires a URL to be provided'); }}
                        target="_source">Find out more</Anchor>
                </Text>

                <Space h="px30" />
                <Grid justify="flex-start" align="center">
                    {Object.values(iucnStatusMapping).map((key, idx) =>
                        <Grid.Col key={idx} span={4}>
                            <Flex justify="flex-start" align="center" gap="xs">
                                <ConservationStatus status={key as ConservationStatusKey} withLabel />
                            </Flex>
                        </Grid.Col>
                    )}
                </Grid>
            </>
        }

        { (!nativeIntroduced || Object.keys(nativeIntroduced).length == 0) &&
            (!conservationStatus || Object.keys(conservationStatus).length == 0) &&
            <Text>No status information available</Text>
        }
        </Box>
    </>
}

export default StatusView;
