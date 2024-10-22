import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import {Link} from "react-router-dom";
import { rem, Box, Button, Container, Group, Space, Text, TextInput, Title, Anchor, List, Divider } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

function Home({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    const [simpleTaxa, setSimpleTaxa] = useState('');
    const currentUser = useContext(UserContext) as ListsUser;

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Species search', href: '/'},
        ]);
    }, [currentUser]);

    function simpleSearch() {
        console.log(simpleTaxa);
    }

    return (
        <>
            <Container size="lg" mt="xl">
                <Title order={2}>ALA Species Pages</Title>
                <Space h="md"/>
                <Text>
                    The Atlas of Living Australia (ALA) Species Pages provide information on taxonomy, distribution, and
                    conservation status of Australian plants, animals, fungi, and microorganisms.
                </Text>
                <Box>
                    <Group style={{ display: 'flex', alignItems: 'center' }}>
                        <TextInput
                            value={simpleTaxa}
                            size="md"
                            mt="md"
                            style={{ width: '80%' }}
                            onChange={(e) => setSimpleTaxa(e.target.value)}
                            placeholder="Enter species/taxon"
                            rightSectionWidth="auto"
                            leftSection={<IconSearch style={{ width: rem(18), height: rem(18) }} stroke={1.5} />}
                            rightSection={
                                <Button
                                    size="compact-md"
                                    variant="filled"
                                    px={10} mx={5}
                                    fullWidth
                                    onClick={() => simpleSearch()}
                                    >Search</Button>
                            }
                        />
                    </Group>
                    <Space h="xl" />
                    <Box>
                        <Text style={{ width: '80%' }} >
                            <b>Note:</b> the simple search attempts to match a known <b>species/taxon</b> - by its scientific name or common name. If there are no name matches, a <b>full text</b> search will be performed on your query
                        </Text>
                    </Box>
                </Box>
                <Divider mt="xl" mb="xl"/>
                <Box>
                    <Title order={3}>Example species pages</Title>
                    <Space h="md" />
                    <List>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/2a4e373b-913a-4e2a-a53f-74828f6dae7e"
                            >Emu – <i>Dromaius novaehollandiae</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/55213c39-1809-442e-b5fb-03fb99e8d97a"
                            >Australian King-Parrot – <i>Alisterus scapularis</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/5291343e-fdeb-4a65-8ba5-928f5b96acf5"
                            >Australian Magpie – <i>Gymnorhina tibicen</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/c0c829b2-834e-4cf9-b288-2cc2035573ff"
                            >Barramundi – <i>Lates calcarifer</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://id.biodiversity.org.au/taxon/apni/51436646"
                            >Golden Wattle – <i>Acacia pycnantha</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/f2f43ef9-89fd-4f89-8b06-0842e86cfe06"
                            >Eastern Grey Kangaroo – <i>Macropus giganteus</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/c28d755d-229c-47d7-a6ea-7920f636f531"
                            >Swamp Wallaby – <i>Wallabia bicolor</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/ac61fd14-4950-4566-b384-304bd99ca75f"
                            >Duck-Billed Platypus – <i>Ornithorhynchus anatinus</i></Anchor>
                        </List.Item>
                        <List.Item>
                            <Anchor
                                component={Link}
                                to="/species?id=https://biodiversity.org.au/afd/taxa/f557abd1-fc45-4152-869e-b31d4b5d886e"
                            >Common Bearded Dragon – <i>Pogona barbata</i></Anchor>
                        </List.Item>
                    </List>
                </Box>
            </Container>
        </>
    );
}

export default Home;
