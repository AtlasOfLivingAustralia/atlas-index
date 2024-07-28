import {Children, useEffect, useState} from "react";

interface MapViewProps {
    result?: {}
}

function DescriptionView({result}: MapViewProps) {
    const [sections, setSections] = useState([]);

    useEffect(() => {
        if (result?.name) {
            fetchPage(result?.name)
        }
    }, [result]);

    function fetchPage(name) {
        // fetch("https://en.wikipedia.org/api/rest_v1/page/html/" + encodeURIComponent(name.replace(' ', '_'))).then(response => response.text()).then(text => {
        //     parseText(text, true, name)
        // })

        // TODO: remove test example for live fetch
        fetch("http://localhost:8082/static/wiki/Test.html").then(response => response.text()).then(text => {
            parseText(text, true, name)
        })
    }

    function parseText(text, testPage, targetName) {

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

        for (let item of doc.querySelectorAll('.infobox')) item.remove();
        for (let item of doc.querySelectorAll('.infobox.biota')) item.remove();
        for (let item of doc.querySelectorAll('.mw-editsection')) item.remove();
        for (let item of doc.querySelectorAll('.navbar')) item.remove();
        for (let item of doc.querySelectorAll('.reference')) item.remove();
        for (let item of doc.querySelectorAll('.error')) item.remove();
        for (let item of doc.querySelectorAll('.box-Unreferenced_section')) item.remove();
        for (let item of doc.querySelectorAll('.portalbox')) item.remove();

        const node = doc.querySelector('body');

        var newSections = [];
        var tested = !testPage
        var valid = true;
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
                    innerItem: item.innerHTML.replaceAll('href="./', "href=\"" + "https://wikipedia.org/wiki/"),
                    sourceHtml: "<a href='https://wikipedia.org/wiki/" + encodeURI(targetName) + "'target='wikipedia'>Wikipedia</a>&nbsp;Content may be excluded.",
                    rights: "<a href='https://creativecommons.org/licenses/by-sa/4.0/'>Creative Commons Attribution-ShareAlike License 4.0</a>"
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
        {/*{text && <div dangerouslySetInnerHTML={{__html: text}}></div> }*/}

        <div className="speciesDescription">

        {sections && sections.map((section, idx) =>
            <div key={idx}>
                <div className="speciesSectionTitle">{section.title}</div>
                <div className="speciesSectionText" dangerouslySetInnerHTML={{__html: section.innerItem}}></div>
                <div className="speciesSectionText d-flex">
                    Source:&nbsp;
                    <div dangerouslySetInnerHTML={{__html: section.sourceHtml}}></div>
                    <div dangerouslySetInnerHTML={{__html: section.rights}}></div>
                </div>
                {idx != sections.length - 1 && <div className="sectionFoot"></div>}
            </div>
        )}
        </div>

    </>
}

export default DescriptionView;
