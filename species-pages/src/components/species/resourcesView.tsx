import { useEffect, useState } from 'react';
import { Alert, Anchor, Box, Divider, Grid, Notification, Skeleton, Space, Text, Title } from '@mantine/core';
import LargeLinkButton from '../common/externalLinkButton';
import FormatName from '../nameUtils/formatName';
import classes from "./species.module.css";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>;
}

interface Resource {
    name: string | JSX.Element;
    url: string;
    external?: boolean;
    rules?: {
        inSpeciesGroup?: string[];
        inSpeciesList?: string[];
    };
}

interface Author {
    Name: string;
}

interface BhlResource {
    BHLType: string;
    FoundIn: string;
    Volume: string;
    Authors: Author[];
    PartUrl: string;
    ItemUrl: string;
    PartID: string;
    Genre: string;
    Title: string;
    ContainerTitle: string;
    Issue: string;
    Date: string;
    PublicationDate: string;
    PublisherName: string;
    PageRange: string;
    thumbnail: string;
}

function ResourcesView({ result }: MapViewProps) {
    const [bhl, setBhl] = useState<BhlResource[]>([]);
    const [bhlQuery, setBhlQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [onlineResources, setOnlineResources] = useState<Resource[]>([]);
    const maxBhlSize: number = 5;

    useEffect(() => {
        if (!result?.name || !result) {
            return;
        }

        let page = 1;
        let s = [result.name];

        // TODO: add .synonyms to the V2 API
        if (result?.synonyms) {
            result.synonyms.forEach((synonym: any) => {
                s.push(synonym.nameString);
            });
        }

        const searchQuery = encodeURIComponent('"' + s.join('" OR "') + '"');

        // Generate link for humans
        setBhlQuery(import.meta.env.VITE_APP_BHL_URL + `/search?SearchTerm=${searchQuery}&SearchCat=M#/names`);

        let url =
            import.meta.env.VITE_APP_BHL_URL + '/api3' +
            '?op=PublicationSearch' +
            '&searchterm=' +
            searchQuery +
            '&searchtype=C&page=' +
            page +
            '&apikey=' +
            encodeURIComponent(import.meta.env.VITE_BHL_API_KEY) +
            '&format=json';
        setLoading(true);
        setErrorMessage('');
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                if (data?.Result) {
                    setBhl(data.Result);
                }
            })
            .catch((error) => {
                setErrorMessage('Failed to fetch BHL data - ' + error);
            })
            .finally(() => {
                setLoading(false);
            });

        // TODO: This is ugly. Make it better.
        const env = import.meta.env.VITE_MODE; // 'development' or 'production'
        const importResources = env === 'development'
            ? import('../../config/onlineResources.test.json')
            : import('../../config/onlineResources.prod.json');

        importResources
            .then(module => setOnlineResources(module.default))
            .catch(error => console.error('Error loading resources:', error));
    }, [result]);

    /* TODO: Move this to an external file so it can be different between test and prod, for the species listIds.
         Source spreadsheet can be found in https://github.com/AtlasOfLivingAustralia/ux-ui/issues/255

         Rules are applied such that
         1. If no rules exist for a resource, it is visible
         2. All rules must return TRUE for the resource to be visible
         3. A rule returns TRUE if any of the item values exist in the list of rule values.
           - e.g. if the rule is inSpeciesGroup: ["Mammals", "Fungi"] and the item.speciesGroup is ["Mammals", "Reptiles"], the rule returns TRUE
           - e.g. if the rule is inSpeciesGroup: ["Mammals", "Fungi"] and the item.speciesGroup is ["Reptiles", "Amphibians"], the rule returns FALSE
     */

    function isResourceVisible(resource: Resource): boolean  {
        var testsPassed = 0;
        var testsApplied = 0;

        for (const key in resource.rules) {
            if (key === 'inSpeciesGroup') {
                testsApplied++;

                for (const speciesGroup in result?.speciesGroup) {
                    if (resource.rules[key]?.includes(result?.speciesGroup[speciesGroup])) {
                        testsPassed++;
                        break;
                    }
                }
            }

            if (key === 'inSpeciesList') {
                testsApplied++;

                for (const speciesList in result?.speciesList) {
                    if (resource.rules[key]?.includes(result?.speciesList[speciesList])) {
                        testsPassed++;
                        break;
                    }
                }
            }
        }

        return testsApplied === testsPassed;
    }

    return (
        <Box>
            { loading && <><Skeleton height={40} width="100%" radius="md" />
                <Space h="px30" /> </>}
            { errorMessage &&
                <>
                    <Notification
                        withBorder
                        onClose={() => setErrorMessage('')}
                        title="Error loading BHL results"
                    >
                        {errorMessage}
                    </Notification>
                    <Space h="px30" />
                </>
            }
            {
                bhl && bhl.length > 0 &&
                <>
                    <Title order={3}>
                        Literature
                    </Title>

                    <Space h="px30" />

                    <Title order={4} className={classes.h4grey}>
                        Biodiversity Heritage Library (BHL)
                    </Title>

                    <Space h="px30" />
                    <Text>
                        Showing {1} to {bhl.length > maxBhlSize ? maxBhlSize : bhl.length}  for {" "}
                        <FormatName name={result?.name} rankId={result?.rankID} />.{" "}
                        <Anchor inherit href={bhlQuery} target="bhl">View all results</Anchor>.
                    </Text>
                    { bhl.map((resource, index) => (
                        index < maxBhlSize &&
                            <>
                                <Space h="px15" />
                                <Alert variant="ala-light">
                                    {resource.Authors?.length === 1 ? (
                                        <>{resource.Authors[0].Name}</>
                                    ) : (
                                        <>
                                            {resource.Authors?.slice(0, -2).map((author) => author.Name).join(", ")}
                                            {resource.Authors?.length > 1 && (
                                                <>
                                                    {resource.Authors?.length > 2 && ", "}
                                                    {resource.Authors?.slice(-2).map((author) => author.Name).join(" and ")}
                                                </>
                                            )}
                                        </>
                                    )}
                                    {resource.Authors?.length > 0 && (resource.Date || resource.PublicationDate) && (
                                        <>
                                            {" ("}
                                            {resource.Date || resource.PublicationDate}
                                            {")"}
                                        </>)}
                                    {resource.Title && (resource.PartUrl || resource.ItemUrl) && (
                                        <>{resource.Authors?.length > 0 && ". "}<Text inherit span fs={resource.ItemUrl && 'italic'}>
                                            <Anchor fz="md" inherit href={resource.PartUrl || resource.ItemUrl} target="bhl">
                                                {resource.Title}
                                            </Anchor>.</Text>
                                        </>)}
                                    {resource.ContainerTitle && (
                                        <> {" "}
                                            <i>{resource.ContainerTitle}</i>.
                                        </>)}
                                    {resource.PublisherName && (
                                        <>{" "}
                                            {resource.PublisherName}.
                                        </>
                                    )}
                                    {(!resource.Authors || resource.Authors?.length === 0) && resource.Date && (
                                        <> {resource.Date}
                                            {"; "}
                                        </>)}
                                    {resource.Volume && (
                                        <> {" "}
                                            <Text inherit span fw="bold">{resource.Volume}</Text>,
                                        </>)}
                                    {resource.Issue && (
                                        <> {" ("}
                                            {resource.Issue}{")"},
                                        </>)}
                                    {resource.PageRange && (
                                        <> {" "}
                                            {resource.PageRange}
                                        </>)}
                                </Alert>
                            </>
                        )
                    )}

                    <Space h="px60" />
                    <Divider/>
                    <Space h="px40" />

                </>
            }
            {/*{ !loading && (!bhl || bhl.length === 0) &&*/}
            {/*    <Text>No BHL references found for <FormatName name={result?.name} rankId={result?.rankID} /></Text>*/}
            {/*<Space h="px60" />*/}
            {/*<Divider/>*/}
            {/*<Space h="px40" />*/}
            {/*}*/}


            <Title order={3}>Other resources</Title>
            <Space h="px30" />
            <Grid gutter={{base: 15, md: 20, lg: 35}}>
                {onlineResources.map((resource: Resource, idx) => (
                    <>
                    { isResourceVisible(resource) &&
                        <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={idx} className={classes.primaryButton}>
                            <LargeLinkButton url={resource.url} external={resource.external}>{resource.name}</LargeLinkButton>
                        </Grid.Col>
                    }
                    </>
                ))}
            </Grid>
        </Box>
    );
}

export default ResourcesView;
