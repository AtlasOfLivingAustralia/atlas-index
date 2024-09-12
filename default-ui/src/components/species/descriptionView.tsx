import { Box, Flex, Title, Text, Anchor } from "@mantine/core";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import classes from "./species.module.css";

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any >
}

interface Section {
    title: string | undefined;
    innerItem: string;
    sourceHtml: string | JSX.Element;
    rights: string | JSX.Element;
}

function DescriptionView({result}: MapViewProps) {
    const [sections, setSections] = useState<Section[]>([]);

    useEffect(() => {
        if (result?.name) {
            fetchPage(result?.name)
        }
    }, [result]);

    function fetchPage(name: string) {
        fetch("https://en.wikipedia.org/api/rest_v1/page/html/" + encodeURIComponent(name.replace(' ', '_'))).then(response => response.text()).then(text => {
            parseText(text, true, name)
        })

        // TODO: remove test example for live fetch
        // fetch("http://localhost:8082/static/wiki/Test.html").then(response => response.text()).then(text => {
        //     parseText(text, true, name)
        // })
    }

    function parseText(text: string, testPage: boolean, targetName: string) {

        // check for a redirect "mw:PageProp/redirect"
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const redirect = doc.querySelector('link[rel="mw:PageProp/redirect"]');

        if (redirect) {
            const redirectItem = redirect.getAttribute('href')?.replace(/^.*\//, '');
            if (redirectItem) {
                fetchPage(redirectItem)
            }
            return;
        }

        const selectorsToRemove = [
            '.infobox',
            '.infobox.biota',
            '.mw-editsection',
            '.navbar',
            '.reference',
            '.error',
            '.box-Unreferenced_section',
            '.portalbox',
            '.clade',
        ];

        for (const selector of selectorsToRemove) {
            for (const item of doc.querySelectorAll(selector)) {
                item.remove();
            }
        }

        const node: HTMLElement | null = doc.querySelector('body');

        var newSections: Section[] = [];
        // var tested = !testPage
        // var valid = true;

        if (!node) {
            return
        }

        for (let item of node.children) {
            if (item.tagName == "SECTION") {
                // basic test for validity
                // TODO: enable this test. Today it is using static data for a fixed taxon so it will fail on all other taxon
                // if (!tested) {
                //     var uppercaseData = text.toUpperCase()
                //     tested = true
                //     valid = false
                //     if (result?.data?.rk_family) {
                //         valid = uppercaseData.indexOf(result?.data?.rk_family.toUpperCase()) > 0
                //     }
                //     if (!valid && result?.data?.rk_order) {
                //         valid = uppercaseData.indexOf(result?.data?.rk_family.toUpperCase()) > 0
                //     }
                //     if (!valid && result?.data?.rk_class) {
                //         valid = uppercaseData.indexOf(result?.data?.rk_class.toUpperCase()) > 0
                //     }
                //     if (!valid && result?.data?.rk_phylum) {
                //         valid = uppercaseData.indexOf(result?.data?.rk_phylum.toUpperCase()) > 0
                //     }
                //     if (!valid) {
                //         return
                //     }
                // }

                // identify the title
                var title
                if (item.children?.item(0)?.tagName.match(/H[0-9]/)) {
                    title = item.children.item(0)?.innerHTML
                    item.children.item(0)?.remove()
                } else {
                    // description.title.default=Summary
                    title = "Summary"
                }

                // keep only 'taxon identifiers' table, if it is present
                var newItems = item.querySelectorAll('[aria-labelledby="Taxon_identifiers"]')
                if (newItems && newItems.length > 0) {
                    item = document.createElement("div")
                    item.appendChild(newItems[0])
                }

                {/*wikipedia.licence.comment=Content may be excluded.*/}
                {/*wikipedia.licence.label=Creative Commons Attribution-ShareAlike License 4.0*/}
                newSections.push({
                    title: title,
                    innerItem: item.innerHTML.replace(/href="\.\//g, "href=\"https://wikipedia.org/wiki/"),
                    sourceHtml: <Text span><Anchor href={`https://wikipedia.org/wiki/${encodeURI(targetName)}`} 
                        target='wikipedia'>Wikipedia</Anchor>&nbsp;–&nbsp;some content may be excluded.</Text>,
                    rights: <Anchor href='https://creativecommons.org/licenses/by-sa/4.0/'>Creative Commons Attribution-ShareAlike License 4.0</Anchor>
                })
            }

            setSections(newSections)

        }

        // var valid = true
        // node.each(function (idx, item) {
        //     // include SECTIONS
        // })
    }

    return <>
        { sections && sections.map((section, idx) =>
            <Box key={idx}>
                <Title order={3} mb="md" mt="md">{section.title}</Title>
                <Box className={classes.speciesSectionText} 
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(section.innerItem, 
                        // strip style attribute to avoid odd looking font face and font colour issues
                        { FORBID_ATTR: ['style'] } 
                        ) 
                    }}
                ></Box>
                <Flex gap="md">
                    <Text>Source: { section.sourceHtml }</Text>
                    <Text>Rights: { section.rights }</Text>
                </Flex>
            </Box>
        )}
    </>
}

export default DescriptionView;
