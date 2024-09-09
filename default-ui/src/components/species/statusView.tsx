import { Anchor, Badge, Box, Flex, Grid, Table, Text, Title } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >,
    resultV1?:  Record<PropertyKey, string | number | any >
}

function StatusView({result, resultV1}: MapViewProps) {

    // TODO: This should be fetched from a static source
    const iucnClasses = [
        {
            "code": "EX",
            "name": "Extinct",
            "status": ["Extinct"],
            "bg": "#212121",
            "fg": "#FFC557"
        },
        {
            "code": "EW",
            "name": "Extinct in the Wild",
            "status": ["Extinct in the Wild"],
            "bg": "#212121",
            "fg": "#FFFFFF"
        },
        {
            "code": "CR",
            "name": "Critically Endangered",
            "status": ["Critically Endangered"],
            "bg": "#921D11",
            "fg": "#FFFFFF"
        },
        {
            "code": "EN",
            "name": "Endangered",
            "status": ["Endangered"],
            "bg": "#F26649",
            "fg": "#212121"
        },
        {
            "code": "VU",
            "name": "Vulnerable",
            "status": ["Vulnerable"],
            "bg": "#FFC557",
            "fg": "#212121"
        },
        {
            "code": "NT",
            "name": "Near Threatened",
            "status": ["Near Threatened", "Rare"],
            "bg": "#38613D",
            "fg": "#FFFFFF"
        },
        {
            "code": "LC",
            "name": "Least Concern",
            "status": ["Least Concern"],
            "bg": "#B7CD96",
            "fg": "#212121"
        }
    ]

    const StatusBadge = ({status}: {status: string}) => {
        return iucnClasses && iucnClasses.map((item, idx) =>
            item.status.includes(status) &&
                <Badge 
                    key={idx} 
                    circle size="lg" 
                    h={30}
                    w={30}
                    color={item.bg} 
                    style={{ color: item.fg, paddingLeft: '3px' }}
                >{item.code}</Badge>
            )
    }

    return <>
        <Box>
            <Title order={3} mb="md" mt="md">Native / introduced</Title>
            <Flex justify="flex-start" align="center" gap="xs" mb="sm">
                <IconInfoCircleFilled size={18}/>
                <Text fw={800} fz={16}>About native / introduced</Text>
            </Flex>
            <Text fz="sm">
                This indicates if a species is regarded as introduced to Australia, a state, or territory.
                This can also include Australian native species which have been introduced in areas beyond
                their natural range, e.g a species native to NSW introduced to WA.&nbsp;
                <Anchor inherit onClick={(e) => { e.preventDefault(); alert('Requires a URL to be provided'); }} 
                    target="_source">Find out more</Anchor>
            </Text>
            <Table striped="even" mt="sm" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Place</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Source</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {/* TODO: substitute with actual native/introduced data */}
                    {resultV1?.conservationStatuses && Object.keys(resultV1.conservationStatuses).map((key, idx) =>
                        <Table.Tr key={idx}>
                            <Table.Td>{resultV1.conservationStatuses[key].dr}</Table.Td>
                            <Table.Td>{resultV1.conservationStatuses[key].status}</Table.Td>
                            <Table.Td>{resultV1.conservationStatuses[key].dr}</Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Title order={3} mb="md" mt="md">Conservation status</Title>
            <Table striped="even" mt="sm" mb="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Level</Table.Th>
                        <Table.Th>Source status</Table.Th>
                        <Table.Th>IUCN equivalent class</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {resultV1?.conservationStatuses && Object.keys(resultV1.conservationStatuses).map((key, idx) =>
                        <Table.Tr key={idx}>
                            <Table.Td>{resultV1.conservationStatuses[key].dr}</Table.Td>
                            <Table.Td>{resultV1.conservationStatuses[key].status}</Table.Td>
                            <Table.Td>{ iucnClasses && iucnClasses.map((item, idx) =>
                                item.status.includes(resultV1.conservationStatuses[key].status) &&
                                    <StatusBadge status={resultV1.conservationStatuses[key].status} />
                                )}
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Flex justify="flex-start" align="center" gap="xs" mb="sm">
                <IconInfoCircleFilled size={18}/>
                <Text fw={800} fz={16}>About the IUCN Equivalent Classes</Text>
            </Flex>
            <Text fz="sm">
                Atlas of Living Australia have interpreted state and territory status classes to align to the
                equivalent International Union for Conservation of Nature (IUCN) Classes. <Anchor inherit 
                    onClick={(e) => { e.preventDefault(); alert('Requires a URL to be provided'); }} 
                    target="_source">Find out more</Anchor>
            </Text>
            <Grid justify="flex-start" align="center" mt="sm">
                {iucnClasses && iucnClasses.map((item, idx) =>
                    <Grid.Col key={idx} span={4}>
                        <Flex justify="flex-start" align="center" gap="xs">
                            <StatusBadge status={item.name} />
                            <Text span size="xs">{item.name}</Text>
                        </Flex>
                    </Grid.Col>
                )}
            </Grid>
        </Box>
    </>
}

export default StatusView;
