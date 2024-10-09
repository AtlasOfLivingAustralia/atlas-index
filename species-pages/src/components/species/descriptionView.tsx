import {Box, Flex, Title, Text, Divider, Skeleton, Space} from "@mantine/core";
import DOMPurify from "dompurify";
import classes from "./species.module.css";
import {IconInfoCircleFilled} from "@tabler/icons-react";
import {TaxonDescription} from "../../api/sources/model.ts";

interface MapViewProps {
    descriptions?: TaxonDescription[];
}

function DescriptionView({descriptions}: MapViewProps) {

    return <>
        <Flex justify="flex-start" align="center" gap="xs" mb="sm">
            <IconInfoCircleFilled size={18}/>
            <Text fw={800} fz={16}>About descriptions</Text>
        </Flex>
        <Text fz="sm">
            Descriptive content has been sourced from several authoritative sources of information e.g. museums and herbaria. Links to further information are included in each section.
        </Text>
        <Space h="px60" />
        {descriptions === undefined &&
                    <Box>
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
                            { 'summary' !== key && <Title order={4} mb="px15" className={classes.h4grey}>{key}</Title> }
                            {/* Leaving this header 'just in case'. taxon-descriptions does sanitize this content. */}
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
