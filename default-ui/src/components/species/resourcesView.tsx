import { useEffect, useState } from 'react';
import { Anchor, Box, Button, Code, Divider, Grid, Notification, Skeleton, Space, Table, Text, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import classes from '../species/species.module.css';
import LargeLinkButton from '../common/ExternalLinkButton';
import FormatName from '../nameUtils/formatName';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>;
}

interface Resource {
    name: string | JSX.Element;
    url: string;
    external?: boolean;
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
    const maxBhlSize: number = 10;

    useEffect(() => {
        if (!result?.name || !result) {
            return;
        }

        let page = 1;
        let s = [result.name];

        if (result?.synonyms) {
            result.synonyms.forEach((synonym: any) => {
                s.push(synonym.nameString);
            });
        }

        const searchQuery = encodeURIComponent('"' + s.join('" OR "') + '"');

        // Generate link for humans
        // https://biodiversitylibrary.org/search?SearchTerm="Macropus giganteus"+OR+"Macropus giganteus tasmaniensis"&SearchCat=M#/names
        setBhlQuery(`https://biodiversitylibrary.org/search?SearchTerm=${searchQuery}&SearchCat=M#/names`); 

        let url =
            'https://www.biodiversitylibrary.org/api3' +
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
                console.error('Failed to fetch BHL data - ' + error);
                setErrorMessage('Failed to fetch BHL data - ' + error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [result]);
    
    const onlineResources: Resource[] = [
        {
            name: <>Australian Reference<br/> Genome Atlas (ARGA)</>,
            url: "https://www.arga.net.au/",
            external: true
        },
        {
            name: "API",
            url: "https://api.ala.org.au/",
        },
        {
            name: "Australian Museum",
            url: "https://australian.museum/",
            external: true
        },
        {
            name: "Queensland Museum",
            url: "https://www.qm.qld.gov.au/",
            external: true
        },
        {
            name: "Fauna of Australia Profile",
            url: "https://www.environment.gov.au/biodiversity/abrs/online-resources/fauna/index",
            external: true
        },
        {
            name: <>Species Profile and Threats<br/> Database (SPRAT)</>,
            url: "https://www.environment.gov.au/cgi-bin/sprat/public/publicspecies.pl",
            external: true
        },
        {
            name: "PestSmart Management Toolkit",
            url: "https://pestsmart.org.au/",
            external: true
        }
    ];
    return (
        <Box>
            <Title order={3} mb="md" mt="md">
                Literature
            </Title>
            
            <Title order={4} c="gray" mb="sm" mt="sm">
                Biodiversity Heritage Library (BHL)
            </Title>

            { loading && <Skeleton height={800} mt="lg" width="100%" radius="md" /> }
            { errorMessage && (
                <Notification
                    withBorder
                    mt="lg"
                    onClose={() => setErrorMessage('')}
                    title="Error loading BHL results"
                >
                    {errorMessage}
                </Notification>
            )}
            {
                bhl && bhl.length > 0 &&
                <>
                    <Text mt="md">
                        Showing {1} to {bhl.length > maxBhlSize ? maxBhlSize : bhl.length} of {" "}
                        {bhl.length == 100 ? `${bhl.length}+` : bhl.length} result{bhl.length > 1 && 's'} for {" "}
                        <FormatName name={result?.name} rankId={result?.rankID} />.{" "}
                        <Anchor inherit href={bhlQuery} target="bhl">View all results on BHL</Anchor>.
                    </Text>
                    <Table striped="even" verticalSpacing="sm" mt="xs" fz="md">
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>#</Table.Th>
                                <Table.Th>Reference</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            { bhl.map((resource, index) => (
                                index < maxBhlSize && 
                                    <Table.Tr>
                                        <Table.Td style={{verticalAlign: 'top'}}>
                                            {index + 1} 
                                            </Table.Td>
                                        <Table.Td>
                                            {/* <Code>{JSON.stringify(resource)}</Code> */}
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
                                        </Table.Td>
                                    </Table.Tr>
                                )
                            )}
                        </Table.Tbody>
                    </Table>
                </>
            }
            { !loading && (!bhl || bhl.length === 0) &&
                <Text mt="md">No BHL references found for <FormatName name={result?.name} rankId={result?.rankID} /></Text>
            }
            
            <Space h="lg" />
            <Divider mt="lg" mb="lg"/>
            <Title order={4} c="gray" mb="lg" mt="lg">Online resources</Title>
            <Grid mt="lg" gutter={{base: 15, md: 20, lg: 35}}>
                {onlineResources.map((resource: Resource, idx) => (
                    <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={idx}>
                        <LargeLinkButton url={resource.url} external={resource.external}>{resource.name}</LargeLinkButton>
                    </Grid.Col>
                ))}
            </Grid>
        </Box>
    );
}

export default ResourcesView;