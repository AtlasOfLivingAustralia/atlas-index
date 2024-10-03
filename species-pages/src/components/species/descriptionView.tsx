import {Box, Flex, Title, Text, Divider, Skeleton, Space} from "@mantine/core";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import classes from "./species.module.css";
import {IconInfoCircleFilled} from "@tabler/icons-react";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any >
}

function DescriptionView({result}: MapViewProps) {
    const [loading, setLoading] = useState<boolean>(false);
    const [descriptions, setDescriptions] = useState<any[]>([]);

    useEffect(() => {
        if (result?.name) {
            fetchPage(result?.guid)
        }
    }, [result]);

    function fetchPage(lsid: string) {

        setLoading(true)

        // doubly encoded; once for the file name, once for service (e.g. Cloudfront or http-server) that translate the URL encoding to the file name
        var lsidEncoded = encodeURIComponent(encodeURIComponent(lsid))

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + "/" + lsidEncoded.substring(lsidEncoded.length - 2) + "/" + lsidEncoded + ".json")
        .then(response => response.json()).then(json => {
            setDescriptions(json)
        })
        .finally(() => {
            setLoading(false);
        })
    }

    return <>
        <Flex justify="flex-start" align="center" gap="xs" mb="sm">
            <IconInfoCircleFilled size={18}/>
            <Text fw={800} fz={16}>About descriptions</Text>
        </Flex>
        <Text fz="sm">
            Descriptive content has been sourced from several authoritative sources of information e.g. museums and herbaria. Links to further information are included in each section.
        </Text>
        <Space h="px60" />
        { loading &&
                    <Box>
                        {/*<Skeleton height={40} mt="lg" width="20%" radius="md" />*/}
                        <Skeleton height={40} mt="lg" width="90%" radius="md" />
                    </Box>
                }
        { descriptions && descriptions.map((description, idx) =>
            <Box key={idx}>
                { idx > 0 && <Divider mt="px40" mb="px40"/> }
                <Title order={3}>{description.name}</Title>
                { description && Object.keys(description).map((key, idx) =>
                    // if key is not in the list of keys to display, skip
                    !['name', 'attribution', 'url'].includes(key) &&
                        <Box key={idx} className={classes.speciesSection}>
                            <Space h="px30"/>
                            {/* The title 'summary' is present only on wikipedia data and should be suppressed */}
                            { 'summary' !== key && <Title order={4} mb="px15" style={{ color: '#637073' }}>{key}</Title> }
                            {/* TODO: content should be sanitized by the time it arrives on this page, by taxon-descriptions tool */}
                            <Box className={classes.speciesSectionText} dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(description[key])}} />
                        </Box>
                )}
                <Flex gap="md" mt="px30">
                    <Text>Source: </Text>
                    <Text dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(description.attribution)}}></Text>
                </Flex>
            </Box>
        )}
    </>
}

export default DescriptionView;
