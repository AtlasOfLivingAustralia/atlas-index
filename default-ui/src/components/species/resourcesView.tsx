import { Box, Button, Divider, Grid, Space, Text, Title } from '@mantine/core';
import BhlContent from '../resources/BhlContent.tsx';
import { IconArrowRight } from '@tabler/icons-react';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>;
    resultV1?: Record<PropertyKey, string | number | any>;
}

interface Resource {
    name: string | JSX.Element;
    url: string;
}

function ResourcesView({ result, resultV1 }: MapViewProps) {
    const onlineResources: Resource[] = [
        {
            name: <Text fw="bold" ta="left" p="sm" pl={0}>Australian Reference<br/> Genome Atlas (ARGA)</Text>,
            url: "https://www.arga.net.au/"
        },
        {
            name: "API",
            url: "https://api.ala.org.au/"
        },
        {
            name: "Australian Museum",
            url: "https://australian.museum/"
        },
        {
            name: "Queensland Museum",
            url: "https://www.qm.qld.gov.au/"
        },
        {
            name: "Fauna of Australia Profile",
            url: "https://www.environment.gov.au/biodiversity/abrs/online-resources/fauna/index"
        },
        {
            name: <Text fw="bold" ta="left" p="sm" pl={0}>Species Profile and Threats<br/> Database (SPRAT)</Text>,
            url: "https://www.environment.gov.au/cgi-bin/sprat/public/publicspecies.pl"
        },
        {
            name: "PestSmart Management Toolkit",
            url: "https://pestsmart.org.au/"
        }
    ];
    return (
        <Box>
            <Title order={3} mb="md" mt="md">
                Literature
            </Title>
            <BhlContent result={result} resultV1={resultV1} />
            <Space h="lg" />
            <Divider mt="lg" mb="lg"/>
            <Title order={4} c="gray" mb="lg" mt="lg">Online resources</Title>
            <Grid mt="lg"  gutter={35}>
                {onlineResources.map((resource: Resource, idx) => (
                    <Grid.Col span={4} key={idx}>
                        <Button 
                            fullWidth
                            justify="space-between"
                            variant="default"  
                            style={{ borderColor: 'var(--mantine-color-rust-outline)' }}
                            rightSection={<IconArrowRight size={20} color={'var(--mantine-color-rust-outline)'}/>}
                            onClick={() => window.open(resource.url, "_blank")}
                            h={75}
                            size="md"
                        >{resource.name}</Button>
                    </Grid.Col>
                ))}
            </Grid>
        </Box>
    );
}

export default ResourcesView;