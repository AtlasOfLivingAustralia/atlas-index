import { Anchor, Button, Flex, Grid, Image, Notification, Paper, Skeleton, Space, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { IconDownload, IconExternalLink, IconInfoCircleFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
// import FormatName from "../nameUtils/formatName";
import classes from './species.module.css';

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

interface TraitLoadings {
    type: null | 'count' | 'summary';
    loading: null | boolean;
    errorMessage: null | string;
}

function TraitsView({ result }: MapViewProps) {

    const [traitsText, setTraitsText] = useState('');

    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState<Record<PropertyKey, string | number | any >>({});

    const [loadingCounts, setLoadingCounts] = useState(false);
    const [errorMessageCounts, setErrorMessageCounts] = useState('');

    const [loadingSummary, setLoadingSummary] = useState(false);
    const [errorMessageSummary, setErrorMessageSummary] = useState('');

    // const traitsCount = [
    //     {
    //         "summary": 16,
    //         "AusTraits": 15,
    //         "taxon": "Podocarpus drouynianus",
    //         "explanation": "There are 16 traits available for Podocarpus drouynianus, with data for 15 further traits in the AusTraits database. These are accessible via the download CSV button or alternatively the entire database can be accessed at doi.org/10.5281/zenodo.10156222"
    //     }
    // ];
    // const traits = {
    //     "numeric_traits": [
    //         {
    //             "unit": "m",
    //             "min": "0.75",
    //             "max": "3",
    //             "mean": "1.88",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0010023",
    //             "trait_name": "Plant vegetative height"
    //         },
    //         {
    //             "unit": "mm",
    //             "min": "30",
    //             "max": "120",
    //             "mean": "75",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011213",
    //             "trait_name": "Leaf length"
    //         },
    //         {
    //             "unit": "mm",
    //             "min": "2",
    //             "max": "6",
    //             "mean": "4",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011214",
    //             "trait_name": "Leaf width"
    //         }
    //     ],
    //     "categorical_traits": [
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030010",
    //             "trait_values": "shrub, tree  *",
    //             "trait_name": "Plant growth form"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030012",
    //             "trait_values": "perennial",
    //             "trait_name": "Life history"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011316",
    //             "trait_values": "simple",
    //             "trait_name": "Leaf compoundness"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030211",
    //             "trait_values": "zoochory",
    //             "trait_name": "Diaspore dispersal syndrome"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030513",
    //             "trait_values": "basal buds",
    //             "trait_name": "Bud bank location"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030652",
    //             "trait_values": "post fire recruitment absent",
    //             "trait_name": "Post-fire recruitment"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030028",
    //             "trait_values": "arbuscular mycorrhizal",
    //             "trait_name": "Plant root structures"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030060",
    //             "trait_values": "dioecious",
    //             "trait_name": "Plant sex type"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012516",
    //             "trait_values": "strobilus",
    //             "trait_name": "Fruit type"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012618",
    //             "trait_values": "ovoid",
    //             "trait_name": "Seed shape"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030024",
    //             "trait_values": "evergreen",
    //             "trait_name": "Leaf phenology"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012623",
    //             "trait_values": "receptacle",
    //             "trait_name": "Dispersal appendage"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011311",
    //             "trait_values": "linear",
    //             "trait_name": "Leaf shape"
    //         }
    //     ]
    // }

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        setLoadingCounts(true);
        setErrorMessageCounts('');

        const countUrl = import.meta.env.VITE_APP_BIE_URL + "/trait-count" + getAusTraitsParam();
        fetch(countUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    let text = data[0].explanation;
                    text = text.replace('AusTraits', `<a target="_blank" href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</a>`);
                    text = text.replace(data[0].taxon, '<i>' + data[0].taxon + '</i>'); // TODO: use FormatName component (formats using rankID)
                    text = text.replace(/(doi.org[^ ]*)/g, '<a target="_blank" href="https://$1">$1</a>');
                    setTraitsText(text);
                }
            })
            .catch(error => {
                console.warn("Trait-count error", error);
                setErrorMessageCounts("Traits counts - " + error + " - " + countUrl);
            })
            .finally(() => {
                setLoadingCounts(false);
            });

        setLoadingSummary(true);
        setErrorMessageSummary('');

        const summaryUrl = import.meta.env.VITE_APP_BIE_URL + "/trait-summary" + getAusTraitsParam();
        fetch(summaryUrl, {
            headers: {
                'Content-Type': 'application/json'}
        })
        .then(response => response.json())
        .then(data => {
            var hasMore = false;
            if (data?.categorical_traits) {
                data.categorical_traits.forEach((item: Record<string, any>) => {
                    if (item.trait_values.endsWith("*")) {
                        hasMore = true;
                    }
                })
                setHasMoreValues(hasMore)
                setTraits(data)
            }
        })
        .catch(error => {
            console.warn("Trait-summary error", error);
            setErrorMessageSummary("Traits summary - " + error + " - " + summaryUrl);
        })
        .finally(() => {
            setLoadingSummary(false);
        });
    }, [result]);

    function getAusTraitsParam() {
        if (result?.name) {
            return "?taxon=" + encodeURIComponent(result.name) + (result.guid.includes("apni") ? "&APNI_ID=" + encodeURIComponent(result.guid.split('/')[result.guid.split('/').length - 1]) : "")
        } else {
            return "";
        }
    }

    return <>
        <Grid className={classes.traitsSectionText}>
            <Grid.Col span={{ base: 12, md: 3, lg: 3 }}>
                <Flex justify="flex-start" align="center" gap="xs" mb="sm">
                    <IconInfoCircleFilled size={18}/>
                    <Text fw={800} >About traits</Text>
                </Flex>
                <Text mt="sm">
                    The trait data shown here are a selection from{" "}
                    <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                        AusTraits
                    </Anchor>
                    , an open-source, harmonised database of Australian plant trait data, sourced from individual researchers, government entities (e.g. herbaria) or NGOs across Australia.
                </Text>
                <Text mt="sm">
                    Traits vary in scope from morphological attributes (e.g. leaf area, seed mass, plant height) to ecological attributes (e.g. fire response, flowering time, pollinators) and physiological measures of performance (e.g. photosynthetic gas exchange, water-use efficiency).{" "}
                    <Anchor inherit href="#" target="_blank">
                        Find out more
                    </Anchor>
                </Text>
                <Text mt="sm">
                    Source:{" "}
                    <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_DOI} target="_blank">
                        Zenodo
                    </Anchor>
                    <br />
                    Rights holder:{" "}
                    <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                        AusTraits
                    </Anchor>
                    <br />
                    Provided by:{" "}
                    <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                        AusTraits
                    </Anchor>
                </Text>
                <Image src={import.meta.env.VITE_APP_AUSTRAITS_LOGO} alt="Austraits logo" mt="lg" mb="lg"/>
                <Paper 
                    mt="lg" 
                    p="md"
                    radius="md"
                    className={classes.citeAusTraits}
                >
                    <Text fw={800}>How to cite AusTraits data</Text>
                    <Text mt="sm">
                        Falster, Gallagher et al (2021) AusTraits, a curated plant trait database for the Australian flora. Scientific Data 8: 254,{" "}
                        <Anchor inherit href="https://doi.org/10.1038/s41597-021-01006-6" target="_blank">
                            https://doi.org/10.1038/s41597-021-01006-6
                        </Anchor>{" "}
                        - followed by the ALA url and access date For more information about citing information on the ALA, see -{" "}
                        <Anchor inherit href={import.meta.env.VITE_CITE_URL} target="_blank">
                            Citing the ALA
                        </Anchor>
                        .
                    </Text>
                </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 0, md: 0, lg: 1 }}>
                <Space />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8, lg: 8 }}>
                { loadingCounts && 
                    <>
                        <Skeleton height={75} mt="lg" width="90%" radius="md" />
                        <Skeleton height={40} mt="lg" width="50%" radius="md" />
                    </>
                }
                { errorMessageCounts && 
                    <Notification 
                        withBorder 
                        onClose={() => setErrorMessageCounts('')}
                        title="Error loading trait data"
                    >
                        {errorMessageCounts}
                    </Notification>
                }
                { traitsText && 
                    <>
                        <Text dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(traitsText)}}></Text>
                        <Flex gap="lg" mt="lg" mb="lg" direction={{ base: 'column', md: 'row' }}>
                            <Button 
                                variant="outline"
                                onClick={() => {
                                    window.open(import.meta.env.VITE_AUSTRAITS_DEFINITIONS, '_blank');
                                }}
                                rightSection={<IconExternalLink size={20} />}
                            >
                                AusTraits definitions
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => {
                                    window.open(import.meta.env.VITE_APP_BIE_URL + "/download-taxon-data" + getAusTraitsParam(), '_blank');
                                }}
                                rightSection={<IconDownload size={20} />}
                            >
                                Download CSV
                            </Button>
                        </Flex>
                        
                        {traits?.categorical_traits?.length > 0  && 
                            <>
                                <Title order={3} mb="md" mt="md">Categorical Traits</Title>
                                { hasMoreValues &&
                                    <Text fs="italic">* Data sources in AusTraits report multiple values for this
                                        trait, suggesting variation across the taxon's range and life stages. Please download the raw
                                        data with information about the context of data collection to assess whether they are
                                        relevant to your project.</Text>
                                }
                                <Table striped="even" mb="sm" mt="sm">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Trait name</Table.Th>
                                            <Table.Th>Trait value</Table.Th>
                                            <Table.Th>Definition</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        { traits?.categorical_traits.map((item: Record<string, any>, idx: number) =>
                                            <Table.Tr key={idx}>
                                                <Table.Td>{item.trait_name}</Table.Td>
                                                <Table.Td>{item.trait_values}</Table.Td>
                                                <Table.Td>
                                                    <UnstyledButton 
                                                        variant="default" 
                                                        size="sm"
                                                        onClick={() => {
                                                            window.open(item.definition, '_blank');
                                                        }}
                                                    >
                                                        <IconExternalLink size={18} />
                                                    </UnstyledButton>
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </>
                        }
                    </>
                }

                { loadingSummary && 
                    <>
                        <Skeleton height={40} mt="lg" width="40%" radius="md" />
                        <Skeleton height={800} mt="lg" width="90%" radius="md" />
                    </>
                }
                { errorMessageSummary && 
                    <Notification 
                        withBorder 
                        onClose={() => setErrorMessageSummary('')}
                        title="Error loading trait data"
                    >
                        {errorMessageSummary}
                    </Notification>
                }
                { traits?.numeric_traits?.length > 0  && 
                    <>
                        <Title order={3} mb="md" mt="md">Numeric Traits</Title>
                        <Table striped="even" mb="sm" mt="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Trait Name</Table.Th>
                                    <Table.Th>Min</Table.Th>
                                    <Table.Th>Mean</Table.Th>
                                    <Table.Th>Max</Table.Th>
                                    <Table.Th>Unit</Table.Th>
                                    <Table.Th>Definition</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                { traits?.numeric_traits.map((item: Record<string, any>, idx: number) =>
                                    <Table.Tr key={idx}>
                                        <Table.Td>{item.trait_name}</Table.Td>
                                        <Table.Td>{item.min}</Table.Td>
                                        <Table.Td>{item.mean}</Table.Td>
                                        <Table.Td>{item.max}</Table.Td>
                                        <Table.Td>{item.unit}</Table.Td>
                                        <Table.Td>
                                            <UnstyledButton 
                                                variant="default" 
                                                size="sm"
                                                onClick={() => {
                                                    window.open(item.definition, '_blank');
                                                }}
                                            >
                                                <IconExternalLink size={18}/>
                                            </UnstyledButton>
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </>
                }
            </Grid.Col>
        </Grid>
    </>
}

export default TraitsView;
