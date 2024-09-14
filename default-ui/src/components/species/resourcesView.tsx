import { useEffect, useState } from 'react';
import { Anchor, Box, Button, Divider, Grid, Notification, Paper, Skeleton, Space, Text, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import classes from '../species/species.module.css';
import LargeLinkButton from '../common/ExternalLinkButton';

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
    PartID: string;
    Genre: string;
    Title: string;
    ContainerTitle: string;
    Issue: string;
    Date: string;
    PageRange: string;
    thumbnail: string;
}

function ResourcesView({ result }: MapViewProps) {
    const [bhl, setBhl] = useState<BhlResource[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

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

        let url =
            'https://www.biodiversitylibrary.org/api3' +
            '?op=PublicationSearch' +
            '&searchterm=' +
            encodeURIComponent('"' + s.join('" OR "') + '"') +
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
                Biodiversity Heritage Library
            </Title>

            { loading && <Skeleton height={800} mt="lg" width="100%" radius="md" /> }
            { errorMessage && (
                <Notification
                    withBorder
                    mt="lg"
                    onClose={() => setErrorMessage('')}
                    title="Error loading datasets"
                >
                    {errorMessage}
                </Notification>
            )}
            { bhl && bhl.map((resource, index) => (
                    <Paper className={classes.citation}  mt="sm" p="md" key={index} >
                        {resource.Authors?.slice(0, -2).map((author) => author.Name).join(", ")}
                        {resource.Authors?.length > 1 && (
                            <>
                                {resource.Authors?.length > 2 && ", "}
                                {resource.Authors?.slice(-2).map((author) => author.Name).join(" and ")}
                            </>
                        )}
                        {resource.Authors?.length > 1 && resource.Date && (
                            <> {"("}
                                {resource.Date}
                                {")."}
                            </>)}
                        {resource.Title && resource.PartUrl && (
                            <> {" "}
                                <Anchor href={resource.PartUrl} target="_blank" rel="noreferrer">
                                    {resource.Title}
                                </Anchor>.
                            </>)}
                        {resource.ContainerTitle && (
                            <> {" "}
                                <i>{resource.ContainerTitle}</i>.
                            </>)}
                        {(!resource.Authors || resource.Authors?.length === 0) && resource.Date && (
                            <> {resource.Date}
                                {"; "}
                            </>)}
                        {resource.Volume && (
                            <> {" "}
                                <Text span fw="bold">{resource.Volume}</Text>,
                            </>)}
                        {resource.Issue && (
                            <> {" ("}
                                {resource.Issue}{")"},
                            </>)}
                        {resource.PageRange && (
                            <> {" "}
                                {resource.PageRange}
                            </>)}
                    </Paper>
                ))
            }
            <Space h="lg" />
            <Divider mt="lg" mb="lg"/>
            <Title order={4} c="gray" mb="lg" mt="lg">Online resources</Title>
            <Grid mt="lg" gutter={35}>
                {onlineResources.map((resource: Resource, idx) => (
                    <Grid.Col span={4} key={idx}>
                        <LargeLinkButton url={resource.url} external={resource.external}>{resource.name}</LargeLinkButton>
                    </Grid.Col>
                ))}
            </Grid>
        </Box>
    );
}

export default ResourcesView;