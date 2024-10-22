import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import MapView from "../components/species/mapView.tsx";
import ClassificationView from "../components/species/classificationView.tsx";
import DescriptionView from "../components/species/descriptionView.tsx";
import ImagesView from "../components/species/imagesView.tsx";
import NamesView from "../components/species/namesView.tsx";
import StatusView from "../components/species/statusView.tsx";
import TraitsView from "../components/species/traitsView.tsx";
import DatasetsView from "../components/species/datasetsView.tsx";
import ResourcesView from "../components/species/resourcesView.tsx";
import { Alert, Anchor, Box, Code, Container, Divider, Flex, Grid, Image, List, Space, Tabs, Text, Title } from "@mantine/core";
import { IconCircleFilled, IconFlagFilled } from "@tabler/icons-react";
import BreadcrumbSection from "../components/header/breadcrumbs.tsx";
import capitalizeFirstLetter from "../helpers/Capitalise.ts";
// import Breadcrumbs from "../components/breadcrumbs/breadcrumbs.tsx";
// @ts-ignore
import {TaxonDescription} from "../../api/sources/model.ts";

import descriptionLabelsConfig from "../config/firstDescriptionLabels.json";
const descriptionLabels: string[] = descriptionLabelsConfig as string[];

import classes from '../components/species/species.module.css';
import { useDocumentTitle } from "@mantine/hooks";
import FormatName from "../components/nameUtils/formatName.tsx";
import DOMPurify from "dompurify";

function Species({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string
}) {
    const [tab, setTab] = useState('map');
    const [result, setResult] = useState<Record<PropertyKey, string | number | any >>({});
    const [descriptions, setDescriptions] = useState<TaxonDescription[]>([]);
    const [firstDescription, setFirstDescription] = useState<string>('');

    const [dataFetched, setDataFetched] = useState(false);
    const [invasiveStatus, setInvasiveStatus] = useState(false);

    useDocumentTitle(`${result?.name}: ${result?.commonName?.join(', ')}`);

    useEffect(() => {
        setBreadcrumbs([]); // Clear breadcrumbs so App.tsx doesn't show them
    }, []);

    const breadcrumbValues: Breadcrumb[] = [
        {title: 'Home', href: import.meta.env.VITE_HOME_URL},
        {title: 'Search species', href: '/'},
        {title: <FormatName name={result.name} rankId={result.rankID}/>, href: ''},
    ];

    useEffect(() => {
        let request = [queryString?.split("=")[1]]
        setDataFetched(false);
        setResult({});
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/species", {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('V2 error: ' + response.status);
            }
        })
        .then(data => {
            if (data[0] && data[0] !== null) {
                var sdsStatusValue = false
                Object.keys(data[0]).map(key => {
                    if (key.startsWith('sds_')) {
                        sdsStatusValue = true;
                    }
                });
                data[0].sdsStatus = sdsStatusValue;

                var invasiveStatusValue = false;
                if (data[0]?.native_introduced_s) {
                    var nativeIntroduced = JSON.parse(data[0].native_introduced_s);
                    Object.keys(nativeIntroduced).map(key => {
                        if (nativeIntroduced[key].toLowerCase().includes('invasive')) {
                            invasiveStatusValue = true;
                        }
                    });
                }
                setInvasiveStatus(invasiveStatusValue);

                setResult(data[0])

                fetchDescriptions(data[0]?.guid)
            }
        })
        .catch(error => {
            console.warn(error);
            // setResult({});
        })
        .finally(() => {
            setDataFetched(true);
        });

    }, [queryString]);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    // Scientific name is italicized if rank is between 6000 and 8000
    const fontStyle = (rankId: string |number) => {
        return (typeof rankId === 'number' && rankId <= 8000 && rankId >= 6000) ? 'italic' : 'normal';
    }

    if (dataFetched && Object.keys(result).length === 0) {
        return (
            <>
                <Box className={classes.speciesHeader}>
                    <Container py="lg" size="lg">
                        <BreadcrumbSection breadcrumbValues={breadcrumbValues}/>
                        <Title order={3} fw={800} mt="xl">
                            Not found
                        </Title>
                    </Container>
                </Box>
                <Container size="lg" mt="xl">
                    <Text fz="lg" mt="xl">No taxa found for <Code fz="lg">{queryString}</Code></Text>
                </Container>
            </>
        );
    }

    function fetchDescriptions(lsid: string) {

        // doubly encoded; once for the file name, once for service (e.g. Cloudfront or http-server) that translate the URL encoding to the file name
        var lsidEncoded = encodeURIComponent(encodeURIComponent(lsid))

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + "/" + lsidEncoded.substring(lsidEncoded.length - 2) + "/" + lsidEncoded + ".json")
            .then(response => response.json()).then(json => {
            setDescriptions(json)

            // find the first description
            // This is a bit of a hack, but we will attempt to limit the resulting text to 3 lines in the header, even
            // if it is HTML not plain text.
            var firstDescriptionElement = json.find((element: any) =>
                Object.keys(element).some(key => descriptionLabels.includes(key))
            )
            if (firstDescriptionElement) {
                var firstDescriptionKey = Object.keys(firstDescriptionElement).find((key: any) =>
                    descriptionLabels.includes(key)
                )
                if (firstDescriptionKey) {
                    setFirstDescription(trimParagraph(firstDescriptionElement[firstDescriptionKey], 230)) // 230 is a guess
                }
            }
        }).catch(() => {
            // This will disable the 'loading' indicator in DescriptionView
            setDescriptions([])
        });
    }

    function trimParagraph(html: any, maxCharacters: number) {
        // Trim this HTML, that is probably just text and other basic tags contained in a <p> tag.
        // 1. Split into sentences.
        // 2. Include sentences unless the total length exceeds maxCharacters.

        // Create a temporary DOM element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Extract text content from the HTML
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        // Split the text content into sentences
        // TODO: This is a very basic sentence splitting, and should be adjusted as required.
        const sentences = textContent.match(/[^\.!\?]+[\.!\?]+(?=\s|$)/g) || [];

        // Join sentences until the total length exceeds maxCharacters
        let trimmedText = '';
        for (const sentence of sentences) {
            if (trimmedText.length + sentence.length > maxCharacters) {
                break;
            }
            trimmedText += sentence;
        }

        return trimmedText;
    }


    return (
    <>  { Object.keys(result).length > 0 &&
            <>
                <Box className={classes.speciesHeader}>
                <Container py={{ base: 'sm', lg: 'xl'}} size="lg">
                    <BreadcrumbSection breadcrumbValues={breadcrumbValues} />
                    <Grid mt={{ base: 'xs', lg: 'md'}} mb="lg" gutter={0}>
                        <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                            <Title order={2} fw={600} fs={fontStyle(result.rankID)} mt={{ base: 0, lg: 'md'}} mb={{ base: 4, lg: 'xs'}}>
                                {result.name}
                            </Title>
                            {/* <Badge color="gray" radius="sm" mt={6} mb={6} pt={3}>{combinedResult.rank}</Badge> */}
                            <List
                                center
                                size="xs"
                                mb={{ base: 'xs', lg: 'md'}}
                                classNames={{ itemIcon: classes.rankName }}
                                >
                                <List.Item
                                    fz={14}
                                    icon={ <IconCircleFilled size={10} color="gray"/> }
                                >{capitalizeFirstLetter(result.rank) || 'Unknown taxon rank'}</List.Item>
                            </List>
                            { result.commonName && result.commonName.map((name: string, idx: number) =>
                                idx < 3 &&
                                    <Text key={idx} size="lg" mt={{ base: 0, lg: 6}}>{name}</Text>
                            )}
                            <Anchor fz="sm" onClick={() => setTab('names')} underline="always">See names</Anchor>
                            {/* <Text mt={8}>{combinedResult.nameComplete}</Text> */}
                            {firstDescription &&
                                <Text mt="sm" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(firstDescription)}} />
                            }
                            { invasiveStatus &&
                                <Alert icon={<IconFlagFilled />} mt="md" pt={5} pb={5} mr="md">
                                    This species is <Anchor inherit fw={600}
                                    onClick={() => setTab('status')}>considered invasive</Anchor> in
                                    some part of Australia and may be of biosecurity concern.
                                </Alert>
                            }

                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
                            { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 &&
                                <Box mr="sm" mb="sm" key={idx}>
                                    <Image rc={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image"/>
                                </Box>
                            )}
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 2, lg: 2 }} className={classes.hideMobile}>
                            <Flex gap={12} direction={{ base: 'row', lg: 'column' }}>
                                { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 &&
                                    <Box mr="sm" mb="sm" key={idx}>
                                        <Image src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image" />
                                    </Box>
                            )}
                            { result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 &&
                                    <Box mr="sm" mb="sm" key={idx}>
                                        <Image src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image"  />
                                    </Box>
                            )}
                            </Flex>
                        </Grid.Col>
                    </Grid>
                </Container>
            </Box>
            <Box>
                <Tabs
                    id="occurrence-tabs"
                    value={tab}
                    onChange={handleTabChange} >
                    <Container size="lg">
                        <Tabs.List>
                            <Tabs.Tab value="map">Occurrence map</Tabs.Tab>
                            <Tabs.Tab value="classification">Classification</Tabs.Tab>
                            <Tabs.Tab value="description">Description</Tabs.Tab>
                            <Tabs.Tab value="media">Images and sounds</Tabs.Tab>
                            <Tabs.Tab value="names">Names</Tabs.Tab>
                            <Tabs.Tab value="status">Status</Tabs.Tab>
                            <Tabs.Tab value="traits">Traits</Tabs.Tab>
                            <Tabs.Tab value="datasets">Datasets</Tabs.Tab>
                            <Tabs.Tab value="resources">Resources</Tabs.Tab>
                        </Tabs.List>
                    </Container>
                    <Divider mt={-1} />
                </Tabs>
            </Box>
            <Container size="lg">
                <Space h="px60" />
                {tab === 'map' &&
                    <MapView result={result} tab={tab}/>
                }
                {tab === 'classification' &&
                    <ClassificationView result={result}/>
                }
                {tab === 'description' &&
                    <DescriptionView descriptions={descriptions}/>
                }
                {tab === 'media' &&
                    <ImagesView result={result}/>
                }
                {tab === 'names' &&
                    <NamesView result={result} />
                }
                {tab === 'status' &&
                    <StatusView result={result} />
                }
                {tab === 'traits' &&
                    <TraitsView result={result} />
                }
                {tab === 'datasets' &&
                    <DatasetsView result={result} />
                }
                {tab === 'resources' &&
                    <ResourcesView result={result} />
                }
                <Space h="xl" />
            </Container>
            <div className="speciesFooter speciesPage">
                <div className="speciesFooterLine"></div>
                <div className="bi bi-arrow-up-circle-fill float-end speciesFooterUp"
                    onClick={() => window.scrollTo(0, 0)}></div>
            </div>
            </>
        }
    </>
    );
}

export default Species;
