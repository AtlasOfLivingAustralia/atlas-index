/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    CustomFacetFn,
    GenericViewProps,
    RenderItemElements,
    RenderItemParams
} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {getImageThumbnailUrl, renderGenericListItemFn, renderGenericTileItemFn, TileImage} from "../util.tsx";

import speciesGroupMap from "../../../config/speciesGroupsMap.json"
import capitalise from "../../../helpers/Capitalise.ts";
import missingImage from '../../../image/missing-image.png';

import '../../../css/nameFormatting.css';
import FolderIcon from "../../common-ui/icons/folderIcon.tsx";
import {FadeInImage} from "../../common-ui/fadeInImage.tsx";

interface SpeciesGroupMapType {
    [key: string]: {
        name: string;
        children?: any[];
    }
}

// rankMap to convert rank name to rank id for the purposes of sorting
// This from https://github.com/AtlasOfLivingAustralia/ala-name-matching/blob/master/ala-name-matching-model/src/main/java/au/org/ala/names/model/RankType.java
const rankMap: { [key: string]: number } = {
    "domain": 800,
    "kingdom": 1000,
    "subkingdom": 1200,
    "infrakingdom": 1400,
    "superphylum": 1800,
    "phylum": 2000,
    "subphylum": 2200,
    "infraphylum": 2400,
    "superclass": 2800,
    "class": 3000,
    "subclass": 3200,
    "infraclass": 3350,
    "subinfraclass": 3370,
    "superdivision zoology": 3450,
    "division zoology": 3500,
    "subdivision zoology": 3550,
    "supercohort": 3650,
    "cohort": 3700,
    "subcohort": 3750,
    "superorder": 3800,
    "order": 4000,
    "suborder": 4200,
    "infraorder": 4350,
    "parvorder": 4400,
    "superseries zoology": 4445,
    "series zoology": 4450,
    "subseries zoology": 4455,
    "supersection zoology": 4465,
    "section zoology": 4470,
    "subsection zoology": 4475,
    "superfamily": 4500,
    "family": 5000,
    "subfamily": 5500,
    "infrafamily": 5525,
    "supertribe": 5550,
    "tribe": 5600,
    "subtribe": 5700,
    "supergenus": 5900,
    "genus group": 5950,
    "genus": 6000,
    "subgenus": 6400,
    "infragenus": 6500,
    "supersection botany": 6550,
    "section botany": 6600,
    "subsection botany": 6700,
    "superseries botany": 6750,
    "series botany": 6800,
    "subseries botany": 6900,
    "infragenericname": 6925,
    "species group": 6950,
    "superspecies": 6960,
    "species subgroup": 6975,
    "species": 7000,
    "nothospecies": 7001,
    "holomorph": 7100,
    "anamorph": 7120,
    "teleomorph": 7140,
    "subspecies": 8000,
    "nothosubspecies": 8001,
    "infraspecificname": 8005,
    "infrasubspeciesname": 8007,
    "variety": 8010,
    "nothovariety": 8011,
    "subvariety": 8015,
    "form": 8020,
    "nothoform": 8021,
    "subform": 8025,
    "biovar": 8030,
    "serovar": 8040,
    "forma specialis": 8043,
    "cultivargroup": 8045,
    "cultivar": 8050,
    "pathovar": 8080,
    "hybrid": 8150,
    "supragenericname": 8200,
    "informal": 100000,
    "incertae sedis": 150000,
    "species inquirenda": 160000,
    "unranked": 200000
}

function addForGroup(group: any, speciesGroupList: any[], items: any, depth: number) {
    if (items[group.name]) {
        var fq = "speciesGroup:\"" + group.name + "\""; // TODO: escape for double quotes in group.name
        speciesGroupList.push({
            fq: fq,
            label: group.name,
            count: items[group.name],
            depth: depth
        })

        // loop for children
        if (group.children) {
            group.children.forEach((child: any) => {
                addForGroup(child, speciesGroupList, items, depth + 1)
            })
        }
    }
}

export const speciesDefn: GenericViewProps = {
    fq: "idxtype:TAXON OR idxtype:COMMON",

    facetDefinitions: {
        "status": {
            label: "Names", // redundant, this is overridden below
            order: 2,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // looking for status == 'traditionalKnowledge' only
                facet.fieldResult.forEach((status: any) => {
                    if (status.label == 'traditionalKnowledge') {
                        var fq = "status:\"traditionalKnowledge\"";
                        facetList.push({
                            name: "Names",
                            items: [
                                {
                                    fq: fq,
                                    label: "Indigenous Ecological Knowledge name",
                                    count: status.count,
                                    depth: 0
                                }
                            ],
                            order: 2
                        })
                    }
                })
            }
        },
        "speciesGroup": {
            label: "Species group", // redundant, this is overridden below
            order: 3,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // put result in a map, then iterate over the speciesGroupsMap so the output is of the correct structure
                var items: { [key: string]: number } = {}
                facet.fieldResult.forEach((group: any) => {
                    items[group.label] = group.count
                })
                var speciesGroupList: any[] = []
                Object.keys(speciesGroupMap).forEach((key: any) => {
                    var group = (speciesGroupMap as SpeciesGroupMapType)[key];
                    addForGroup(group, speciesGroupList, items, 0)
                })

                if (speciesGroupList.length > 0) {
                    facetList.push({
                        name: "Species group",
                        items: speciesGroupList,
                        order: 3
                    })
                }
            }
        },
        "taxonomicStatus": {
            label: "Taxonomic status",
            order: 4
        },
        "rank": {
            label: "Taxonomic rank", // redundant, this is overridden below
            order: 5,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom sort
                var items: any [] = []
                facet.fieldResult.forEach((status: any) => {
                    var fq = facet.fieldName + ":\"" + status.label + "\"";
                    items.push({
                        fq: fq,
                        label: capitalise(status.label),
                        count: status.count,
                        depth: 0
                    })
                })
                if (items.length > 0) {
                    // sort by rank
                    items.sort((a: any, b: any) => {
                        let left: number = rankMap[a.label.toLowerCase()] || 1000000
                        let right = rankMap[b.label.toLowerCase()] || 1000000
                        return left - right;
                    })

                    facetList.push({
                        name: "Taxonomic rank",
                        items: items,
                        order: 5
                    })
                }
            }
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <FadeInImage
                className={classes.listItemImage}
                src={item.image ? getImageThumbnailUrl(item.image) : missingImage}
                missingImage={missingImage}
            />,
            title: <>
                {item.nameFormatted && <span className={classes.listItemName}
                                             dangerouslySetInnerHTML={{__html: item.nameFormatted}}
                ></span>}
                {!item.nameFormatted && <span className={classes.listItemName}>{item.name}</span>}
                <span className={classes.overflowText}>{item.commonNameSingle}</span>
            </>,
            extra: <>
                {item.speciesGroup && <span className={classes.overflowText}>{item.speciesGroup.join(', ')}</span>}
                {item?.data?.rk_kingdom &&
                    <span className={classes.overflowText}>Kingdom: {item?.data?.rk_kingdom}</span>}
                <span
                    className={classes.listItemText}><FolderIcon/> {item.occurrenceCount ? item.occurrenceCount : 0} occurrence records</span>
            </>,
            description: <>
                {/*TODO: hero description goes here when it is defined */}
            </>,
            clickFn: () => navigate(`/species/${item.idxtype == "TAXON" ? item.guid : item.taxonGuid}`)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile, navigate}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image ? getImageThumbnailUrl(item.image) : undefined} isMobile={isMobile}/>,
            title: <>
                {item.nameFormatted && <span className={classes.listItemName}
                                             dangerouslySetInnerHTML={{__html: item.nameFormatted}}></span>}
                {!item.nameFormatted && <span className={classes.listItemName}>{item.name}</span>}
                <div style={{height: "8px"}}/>
                {item.commonNameSingle &&
                    <span className={classes.listItemText}>{item.commonNameSingle}</span>}
                {item.speciesGroup &&
                    <span className={classes.listItemText}>{item.speciesGroup.join(', ')}</span>}
                {item?.data?.rk_kingdom &&
                    <span className={classes.listItemText}>Kingdom: {item?.data?.rk_kingdom}</span>}
                <span className={classes.listItemText}><FolderIcon/> {item.occurrenceCount ? item.occurrenceCount : 0} occurrence
                    records</span>
                <div style={{height: "13px"}}/>
                {/* TODO: hero description goes here when defined */}
            </>,
            clickFn: () => navigate(`/species/${item.idxtype == "TAXON" ? item.guid : item.taxonGuid}`)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    addCustomFacetsFn: ({url, thisFacetFqs, setCustomFacetData}: CustomFacetFn) => {
        fetch(url + "&fq=image:*").then(response => response.json()).then(data => {
            var items: any[] = [];

            if (data.totalRecords > 0) {
                items.push(
                    {
                        fq: "image:*",
                        label: "Image available",
                        count: data.totalRecords,
                        depth: 0,
                        selected: thisFacetFqs.includes("image:*")
                    })
            }

            fetch(url + "&fq=speciesList:" + import.meta.env.VITE_APP_ICONIC_SPECIES_LIST).then(response => response.json()).then(data => {
                if (data.totalRecords > 0) {
                    items.push(
                        {
                            fq: "speciesList:" + import.meta.env.VITE_APP_ICONIC_SPECIES_LIST,
                            label: "Iconic species",
                            count: data.totalRecords,
                            depth: 0,
                            selected: thisFacetFqs.includes("speciesList:" + import.meta.env.VITE_APP_ICONIC_SPECIES_LIST)
                        })
                }

                if (items.length > 0) {
                    setCustomFacetData([{
                        name: "Type",
                        items: items,
                        order: 1
                    }])
                } else {
                    setCustomFacetData([]);
                }
            })
        });
    }
}
