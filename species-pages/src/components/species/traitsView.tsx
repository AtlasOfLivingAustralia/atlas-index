import {
    Alert,
    Anchor,
    Box,
    Button,
    Flex,
    Grid,
    Image,
    Skeleton,
    Space,
    Table,
    Text,
    Title
} from "@mantine/core";
import {IconExternalLink, IconDownload, IconInfoCircleFilled} from "@tabler/icons-react";
import { useEffect, useState } from "react";
// import FormatName from "../nameUtils/formatName";
import classes from './species.module.css';
import {FlagIcon} from "@atlasoflivingaustralia/ala-mantine";
import FormatName from "../nameUtils/formatName.tsx";

interface MapViewProps {
    result?:  Record<PropertyKey, string | number | any >
}

function TraitsView({ result }: MapViewProps) {

    const [traitsText, setTraitsText] = useState<string>('');
    const [traitsTaxon, setTraitsTaxon] = useState<string>('');

    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState<Record<PropertyKey, string | number | any >>({});

    const [loadingCounts, setLoadingCounts] = useState(false);
    const [errorMessageCounts, setErrorMessageCounts] = useState('');

    const [loadingSummary, setLoadingSummary] = useState(false);
    const [errorMessageSummary, setErrorMessageSummary] = useState('');
    const [moreVisible, setMoreVisible] = useState(false);

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
                    setTraitsTaxon(data[0].taxon);
                    setTraitsText(data[0].explanation);
                }
            })
            .catch(error => {
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

    function explanation(txt: string, taxon: string) {
        const ausTraitsLink = <Anchor target="_blank" href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</Anchor>;
        const taxonName = <FormatName name={taxon} rankId={result?.rankID} />;
        const doiLink = txt.match(/(doi.org[^ ]*)/g)?.map((doi, index) => (
            <Anchor key={index} target="_blank" href={`https://${doi}`}>{doi}</Anchor>
        ));

        return (
            <Text>
                {txt.split('AusTraits').map((part1, index1, array1) => (
                    <>
                        {part1.split(taxon).map((part2, index2, array2) => (
                            <>
                                {part2.split(/(doi.org[^ ]*)/g).map((part3) => (
                                    <>
                                        {part3.match(/doi.org/) ? doiLink : part3}
                                    </>
                                ))}
                                {index2 < array2.length - 1 && taxonName}
                            </>
                        ))}
                        {index1 < array1.length - 1 && ausTraitsLink}
                    </>
                ))}
            </Text>
        );
    }

    function getAusTraitsParam() {
        if (result?.name) {
            return "?taxon=" + encodeURIComponent(result.name) + (result.guid.includes("apni") ? "&APNI_ID=" + encodeURIComponent(result.guid.split('/')[result.guid.split('/').length - 1]) : "")
        } else {
            return "";
        }
    }

    return <>
        <Grid className={`${classes.traitsSectionText} ${classes.layoutGrid}`} gutter={0}>
            <Grid.Col span="content">
                <Box className={classes.traitsLeftColumnWidth}>
                <Flex justify="flex-start" align="center" gap="5px">
                    <IconInfoCircleFilled size={18}/>
                    <Text fw={800} >About traits</Text>
                </Flex>
                <Space h="px10" />
                <Text>
                    The trait data shown here are a selection from{" "}
                    <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                        AusTraits
                    </Anchor>
                    , an open-source, harmonised database of Australian plant trait data, sourced from individual researchers, government entities (e.g. herbaria) or NGOs across Australia.
                </Text>
                <Space h="px10" />
                <Text>
                    Traits vary in scope from morphological attributes (e.g. leaf area, seed mass, plant height) to ecological attributes (e.g. fire response, flowering time, pollinators) and physiological measures of performance (e.g. photosynthetic gas exchange, water-use efficiency).{" "}
                    {!moreVisible && <Anchor inherit onClick={() => setMoreVisible(true)}>Find out more</Anchor>}
                </Text>
                {moreVisible &&
                    <>
                        <Space h="px10" />
                        <Text>These traits are a sampler of those available in{" "}
                            <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                AusTraits
                            </Anchor>
                            . The data presented here are summary statistics derived from all field-collected data on adult plants available from{" "}
                            <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                AusTraits
                            </Anchor>
                            . Since the data presented are derived from the wide variety of sources in{" "}
                            <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                AusTraits
                            </Anchor>
                            , both the numeric trait statistics (min, mean, max) and categorical trait summaries (frequency of each trait value)
                            that have been merged together could include data collected using different methods. The values presented for this
                            species may reflect a summary of data from one or many sources, one or many samples from one or many adult plants at
                            one or many locations. They may therefore differ from those presented elsewhere on the ALA platform and users are
                            encouraged to download a spreadsheet of the full{" "}
                            <Anchor inherit href={import.meta.env.VITE_AUSTRAITS_HOME} target="_blank">
                                AusTraits
                            </Anchor>
                            {" "}data for this species via the download CSV button to view the accompanying details about the data sources before further use.
                        </Text>
                        <Anchor inherit onClick={() => setMoreVisible(false)}>See less</Anchor>
                    </>
                }
                <Space h="px10" />
                <Text>
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
                <Space h="px60" />
                <Image src={import.meta.env.VITE_APP_AUSTRAITS_LOGO} alt="Austraits logo"/>
                <Space h="px60" />
                <Alert variant="ala-light" >
                    <Text fw={800}>How to cite AusTraits data</Text>
                    <Space h="px10" />
                    <Text inherit>
                        Falster, Gallagher et al (2021) AusTraits, a curated plant trait database for the Australian flora. Scientific Data 8: 254,{" "}
                        <Anchor variant="ala" href="https://doi.org/10.1038/s41597-021-01006-6" target="_blank">
                            https://doi.org/10.1038/s41597-021-01006-6
                        </Anchor>{" "}
                        - followed by the ALA url and access date For more information about citing information on the ALA, see -{" "}
                        <Anchor inherit href={import.meta.env.VITE_CITE_URL} target="_blank">
                            Citing the ALA
                        </Anchor>
                        .
                    </Text>
                </Alert>
                </Box>
            </Grid.Col>
            <Grid.Col span={1}>
                <Space />
            </Grid.Col>
            <Grid.Col span={7}>
                { loadingCounts &&
                    <>
                        <Skeleton height={130} mt="lg" width="90%" radius="md" />
                    </>
                }
                { errorMessageCounts &&
                    <>
                        <Alert icon={<FlagIcon />}>
                            <b>Error loading trait data.</b>
                            <p>Report this error by clicking on the <b>Need Help?</b> button on the right edge of the screen.</p>
                            <code>{errorMessageCounts}</code>
                        </Alert>
                    </>
                }
                { traitsText &&
                    <>
                        { explanation(traitsText, traitsTaxon) }

                        { (traits?.categorical_traits?.length > 0 || traits?.numeric_traits?.length > 0) && <>
                            <Space h="px30" />
                            <Flex gap="lg" direction={{ base: 'column', md: 'row' }}>
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
                        </>
                        }
                    </>
                }

                { loadingSummary &&
                    <>
                        <Space h="px60" />
                        <Skeleton height={500} mt="lg" width="90%" radius="md" />
                    </>
                }
                { errorMessageSummary &&
                    <>
                        <Space h="px10" />
                        <Alert icon={<FlagIcon />}>
                            <b>Error loading trait data.</b>
                            <p>Report this error by clicking on the <b>Need Help?</b> button on the right edge of the screen.</p>
                            <code>{errorMessageSummary}</code>
                        </Alert>
                    </>
                }
                {traits?.categorical_traits?.length > 0 &&
                    <>
                        <Space h="px60" />
                        <Title order={3}>Categorical Traits</Title>
                        <Space h="px30" />
                        { hasMoreValues && <>
                            <Text fs="italic">* Data sources in AusTraits report multiple values for this
                                trait, suggesting variation across the taxon's range and life stages. Please download the raw
                                data with information about the context of data collection to assess whether they are
                                relevant to your project.</Text>
                            <Space h="px30" />
                        </>
                        }
                        <Table striped="even">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Trait Name</Table.Th>
                                    <Table.Th>Trait Value</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                { traits?.categorical_traits.map((item: Record<string, any>, idx: number) =>
                                    <Table.Tr key={idx}>
                                        <Table.Td><Anchor href={item.definition}>{item.trait_name}</Anchor></Table.Td>
                                        <Table.Td>{item.trait_values}</Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </>
                }
                { traits?.numeric_traits?.length > 0  &&
                    <>
                        <Space h="px60" />
                        <Title order={3}>Numeric Traits</Title>
                        <Space h="px30" />
                        <Table striped="even">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Trait Name</Table.Th>
                                    <Table.Th ta="right">Min</Table.Th>
                                    <Table.Th ta="right">Mean</Table.Th>
                                    <Table.Th ta="right">Max</Table.Th>
                                    <Table.Th ta="right">Unit</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                { traits?.numeric_traits.map((item: Record<string, any>, idx: number) =>
                                    <Table.Tr key={idx}>
                                        <Table.Td><Anchor href={item.definition}>{item.trait_name}</Anchor></Table.Td>
                                        <Table.Td ta="right">{item.min}</Table.Td>
                                        <Table.Td ta="right">{item.mean}</Table.Td>
                                        <Table.Td ta="right">{item.max}</Table.Td>
                                        <Table.Td ta="right">{item.unit}</Table.Td>
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
