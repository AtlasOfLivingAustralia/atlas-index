import { useEffect, useState } from 'react';
import { Anchor, Box, Divider, Flex, Table, Text, Title, Space } from "@mantine/core";
import classes from "./species.module.css";
import { IconInfoCircleFilled } from "@tabler/icons-react";
// import './species.module.css';

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

function NamesView({ result }: MapViewProps) {

    const [commonNames, setCommonNames] = useState<any[]>([]);
    const [indigenousNames, setIndigenousNames] = useState<any[]>([]);

    useEffect(() => {
        if (result?.vernacularData) {
            setCommonNames(result.vernacularData.filter((item: any) => item.status !== 'traditionalKnowledge'));
            setIndigenousNames(result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge'));
        }
    }, [result]);

    return <>
        <Box>
            <Title order={3}>Scientific names</Title>
            <Space h="px30" />
            <Table striped="even">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Accepted name</Table.Th>
                        <Table.Th w="30%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                <Table.Tr>
                    <Table.Td>
                        <Text
                            dangerouslySetInnerHTML={{
                                // this is from our names index and is already sanitized
                                __html:
                                    // TODO: find a better way to apply CSS rules
                                    result?.nameFormatted
                                        .replace(/class="scientific-name rank-subspecies"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="scientific-name rank-species"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="scientific-name rank-genus"/g, `class="${classes.rankSpecies}"`)
                                        .replace(/class="name"/g, `class="${classes.name}"`)

                            }}
                        ></Text>
                        {result?.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {result?.nameAccordingTo}</Text></>}
                        {result?.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {result?.namePublishedIn}</Text></>}
                    </Table.Td>
                    <Table.Td><Anchor href={result?.source} target="_source">{result?.datasetName}</Anchor></Table.Td>
                </Table.Tr>
                </Table.Tbody>
                <Space h="px30" />
            </Table>

            { result?.synonymData && <>
                <Table striped="even">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Synonyms</Table.Th>
                            <Table.Th w="30%">Source</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {result.synonymData.sort((a: any, b:any) => a.scientificName.localeCompare(b.scientificName)).map((item: any, idx: any) =>
                            <Table.Tr key={idx}>
                                <Table.Td>
                                    {item?.source ?
                                        <Anchor inherit href={item?.source}>{item?.scientificName}</Anchor>
                                        :
                                        <Text inherit>{item.scientificName}</Text>
                                    }
                                    {item.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {item.nameAccordingTo}</Text></>}
                                    {item.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {item.namePublishedIn}</Text></>}
                                </Table.Td>
                                <Table.Td>
                                    {item?.source ?
                                        <Anchor inherit href={item?.source}>{item?.datasetName || 'Link'}</Anchor>
                                        :
                                        <Text inherit>{item?.datasetName}</Text>
                                    }
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
                <Space h="px30" />
                </>
            }

            {result?.variantData && <>
                <Table striped="even">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Variants</Table.Th>
                            <Table.Th w="30%">Source</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {result.variantData.sort((a: any, b:any) => a.scientificName.localeCompare(b.scientificName)).map((item: any, idx: any) =>
                            <Table.Tr key={idx}>
                                <Table.Td>
                                    {item?.source ?
                                        <Anchor inherit href={item?.source}>{item?.scientificName}</Anchor>
                                        :
                                        <Text inherit>{item.scientificName}</Text>
                                    }
                                    {item.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {item.nameAccordingTo}</Text></>}
                                    {item.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {item.namePublishedIn}</Text></>}
                                </Table.Td>
                                <Table.Td>
                                    {item?.source ?
                                        <Anchor inherit href={item?.source}>{item?.datasetName || 'Link'}</Anchor>
                                        :
                                        <Text inherit>{item?.datasetName}</Text>
                                    }
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
                <Space h="px30" />
                </>
            }

            {result?.identifierData && <>
                <Table striped="even">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Identifiers</Table.Th>
                        <Table.Th w="30%">Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    { result.identifierData.sort((a: any, b:any) => a.guid.localeCompare(b.guid)).map((item: any, idx: any) =>
                        <Table.Tr key={idx}>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.source}>{item?.guid}</Anchor>
                                    :
                                    <Text inherit>{item.guid}</Text>
                                }
                                {item.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {item.nameAccordingTo}</Text></>}
                                {item.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {item.namePublishedIn}</Text></>}
                            </Table.Td>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.source}>{item?.datasetName || 'Link'}</Anchor>
                                    :
                                    <Text inherit>{item?.datasetName}</Text>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>
                <Space h="px30" />
                </>
            }

            {commonNames && <>
                <Divider/>
                <Space h="px30" />
                <Title order={3}>Common names</Title>
                <Space h="px30" />
                <Table striped="even">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Common name</Table.Th>
                            <Table.Th w="30%">Source</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                    {commonNames.sort((a: any, b:any) => a.name.localeCompare(b.name)).map((item: any, idx: any) =>
                        <Table.Tr key={idx}>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.source}>{item?.name}</Anchor>
                                    :
                                    <Text inherit>{item.name}</Text>
                                }
                                {item.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {item.nameAccordingTo}</Text></>}
                                {item.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {item.namePublishedIn}</Text></>}
                            </Table.Td>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.source}>{item?.datasetName || 'Link'}</Anchor>
                                    :
                                    <Text inherit>{item?.datasetName}</Text>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                    </Table.Tbody>
                </Table>
                <Space h="px30" />
                </>
            }

            {indigenousNames && indigenousNames.length > 0 && <>
                <Divider/>
                <Space h="px30" />
                <Title order={3}>Indigenous names</Title>
                <Space h="px30" />
                <Flex justify="flex-start" align="center" gap="5px">
                    <IconInfoCircleFilled size={18}/>
                    <Text fw={800} fz={16}>About indigenous names</Text>
                </Flex>
                <Space h="px10" />
                <Text fz="sm">
                    The links from the Indigenous name provide more information about Indigenous Ecological
                    Knowledge (IEK) relating to the species. The link from language group links to the
                    Australian Institute of Aboriginal and Torres Strait Islander Studies
                    (<Anchor href="https://aiatsis.gov.au" target="_source">AIATSIS</Anchor>)
                    information about the language.
                </Text>
                <Space h="px30" />
                <Table striped="even">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th w="30%">See language group</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                    {indigenousNames.sort((a: any, b:any) => a.name.localeCompare(b.name)).map((item: any, idx: any) =>
                        <Table.Tr key={idx}>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.source}>{item?.name}</Anchor>
                                    :
                                    <Text inherit>{item.name}</Text>
                                }
                                {item.nameAccordingTo && <><Space h="px10" /><Text inherit fs="italic">According to: {item.nameAccordingTo}</Text></>}
                                {item.namePublishedIn && <><Space h="px10" /><Text inherit fs="italic">Published in: {item.namePublishedIn}</Text></>}
                            </Table.Td>
                            <Table.Td>
                                {item?.source ?
                                    <Anchor inherit href={item?.languageURL}>{item?.languageName || item?.language}</Anchor>
                                    :
                                    <Text inherit>{item?.languageName || item?.language}</Text>
                                }
                            </Table.Td>
                        </Table.Tr>
                    )}
                    </Table.Tbody>
                </Table>
                </>
            }
        </Box>
    </>
}

export default NamesView;
