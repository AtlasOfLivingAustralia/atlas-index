import { Anchor, Box, Flex, Table, Text, Title } from "@mantine/core";
import DOMPurify from "dompurify";
import classes from "./species.module.css";
import { IconInfoCircleFilled } from "@tabler/icons-react";
// import './species.module.css';

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

function NamesView({ result }: MapViewProps) {

    return <>
        <Box>
            <Title order={3} mb="md" mt="md">Scientific names</Title>
            <Table striped="even" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Accepted name</Table.Th>
                        <Table.Th w="15%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                <Table.Tr>
                    <Table.Td>
                        <Text 
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(
                                    // TODO: find a better way to apply CSS rules
                                    result?.nameFormatted
                                        .replace(/class="scientific-name rank-subspecies"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="scientific-name rank-species"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="scientific-name rank-genus"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="name"/g, `class="${classes.name}"`)
                                ) 
                            }}
                        ></Text>
                    </Table.Td>
                    <Table.Td><Anchor href={result?.source} target="_source">{result?.datasetName}</Anchor></Table.Td>
                </Table.Tr>
                {/* TODO: check for additional accepted names or remove this comment if not applicable */}
                </Table.Tbody>
            </Table>
            <Table striped="even" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Synonyms</Table.Th>
                        <Table.Th w="15%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {result?.synonyms && result.synonyms.map((item, idx) =>
                        <Table.Tr key={idx}>
                            <Table.Td><Text dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(item?.nameFormatted)}}></Text>
                            </Table.Td>
                            <Table.Td>
                                {item?.infoSourceURL ?
                                    <Anchor href={item?.infoSourceURL}>{item?.infoSourceName || item?.nameAuthority}</Anchor>
                                    :
                                    <>{item?.infoSourceName}</>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Table striped="even" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Variants</Table.Th>
                        <Table.Th w="15%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {result?.variants && result.synonyms.map((item, idx) =>
                        <Table.Tr key={idx}>
                            <Table.Td><Text dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(item?.nameFormatted)}}></Text>
                            </Table.Td>
                            <Table.Td>
                                {item?.infoSourceURL ?
                                    <Anchor href={item?.infoSourceURL}>{item?.infoSourceName || item?.nameAuthority}</Anchor>
                                    :
                                    <>{item?.infoSourceName}</>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Table striped="even" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Identifiers</Table.Th>
                        <Table.Th w="15%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {result?.identifiers && result.synonyms.map((item, idx) =>
                        <Table.Tr key={idx}>
                            <Table.Td><Text dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(item?.nameFormatted)}}></Text>
                            </Table.Td>
                            <Table.Td>
                                {item?.infoSourceURL ?
                                    <Anchor href={item?.infoSourceURL}>{item?.infoSourceName || item?.nameAuthority}</Anchor>
                                    :
                                    <>{item?.infoSourceName}</>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Title order={3} mb="md" mt="lg">Common names</Title>
            <Table striped="even">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Common name</Table.Th>
                        <Table.Th w="15%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                {result?.commonNames && result.commonNames.map((item, idx) =>
                    item?.status !== 'traditionalKnowledge' &&
                    <Table.Tr key={idx}>
                        <Table.Td>{item?.nameString}</Table.Td>
                        <Table.Td>
                            {item?.infoSourceURL ?
                                <Anchor inherit href={item?.infoSourceURL} target="_source">{item?.infoSourceName}</Anchor>
                                :
                                item?.infoSourceName
                            }
                        </Table.Td>
                    </Table.Tr>
                )}
                </Table.Tbody>
            </Table>

            <Title order={3} mb="md" mt="lg">Indigenous names</Title>
            <Flex justify="flex-start" align="center" gap="xs" mb="sm">
                <IconInfoCircleFilled size={18}/>
                <Text fw={800} fz={16}>About indigenous names</Text>
            </Flex>
            <Text fz="sm">
                The links from the Indigenous name provide more information about Indigenous Ecological
                Knowledge (IEK) relating to the species. The link from language group links to the 
                Australian Institute of Aboriginal and Torres Strait Islander Studies 
                (<Anchor href="https://aiatsis.gov.au" target="_source">AIATSIS</Anchor>) 
                information about the language. 
            </Text>
            <Table striped="even" mt="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>See language group</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                {result?.commonNames && result.commonNames.map((item, idx) =>
                    item?.status === 'traditionalKnowledge' &&
                    <Table.Tr key={idx}>
                        <Table.Td>{item?.nameString}</Table.Td>
                        <Table.Td>
                            {item?.infoSourceURL ?
                                <Anchor inherit href={item?.infoSourceURL} target="_source">{item?.infoSourceName}</Anchor>
                                :
                                item?.infoSourceName
                            }
                        </Table.Td>
                    </Table.Tr>
                )}
                </Table.Tbody>
            </Table>
        </Box>
    </>
}

export default NamesView;
