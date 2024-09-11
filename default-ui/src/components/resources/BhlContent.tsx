import { useEffect, useState } from 'react';
import { Alert, Anchor, Box, Notification, Paper, Skeleton, Text, Title } from '@mantine/core';
import Bibliography from './bibliography.tsx';
import classes from '../species/species.module.css';

interface BhlContentProps {
    result?: Record<PropertyKey, string | number | any>;
    resultV1?: Record<PropertyKey, string | number | any>;
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

function BhlContent({ result, resultV1 }: BhlContentProps) {
    const [bhl, setBhl] = useState<BhlResource[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (!result?.name || !resultV1) {
            return;
        }

        let page = 1;
        let s = [result.name];

        if (resultV1?.synonyms) {
            resultV1.synonyms.forEach((synonym: any) => {
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
                console.log(data);
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
    }, [result, resultV1]);

    return (
        <Box>
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
                        {/* <Bibliography resource={resource} /> */}
                        {resource.Authors.slice(0, -2).map((author) => author.Name).join(", ")}
                        {resource.Authors.length > 1 && (
                            <>
                                {resource.Authors.length > 2 && ", "}
                                {resource.Authors.slice(-2).map((author) => author.Name).join(" and ")},
                            </>
                        )}
                        {resource.Title && resource.PartUrl && (
                            <> {" "}
                                <Anchor href={resource.PartUrl} target="_blank" rel="noreferrer">
                                    {resource.Title}
                                </Anchor>,
                            </>)}
                        {resource.ContainerTitle && (
                            <> {" "}
                                <i>{resource.ContainerTitle}</i>,
                            </>)}
                        {resource.Volume && (
                            <> {" "}
                                <Text span fw="bold">{resource.Volume}</Text>,
                            </>)}
                        {resource.Issue && (
                            <> {" ("}
                                {resource.Issue}{")"},
                            </>)}
                        {resource.Date && (
                            <> {" "}
                                {resource.Date},
                            </>)}
                        {resource.PageRange && (
                            <> {" "}
                                {resource.PageRange}
                            </>)}
                    </Paper>
                ))
            }
        </Box>
    );
}

export default BhlContent;