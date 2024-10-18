import {Fragment, useEffect, useState} from "react";
import {Anchor, Button, Divider, Flex, Grid, Image, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {ListIcon, TilesIcon, ArrowRightIcon} from '@atlasoflivingaustralia/ala-mantine';
import {useNavigate} from "react-router-dom";
import {speciesDefn} from "./speciesDefn.tsx";
import {limitDescription, openUrl} from "./util.tsx";
import {datasetsDefn} from "./datasetsDefn.tsx";
import {dataprojectsDefn} from "./dataprojectsDefn.tsx";
import {specieslistDefn} from "./specieslistDefn.tsx";
import {environmentallayersDefn} from "./environmentallayersDefn.tsx";
import {regionslocalitiesDefn} from "./regionslocalitiesDefn.tsx";
import {wordpressDefn} from "./wordpressDefn.tsx";
import {supportDefn} from "./supportDefn.tsx";

interface ViewProps {
    queryString?: string | undefined
}

function AllView({queryString}: ViewProps) {
    const [filter, setFilter] = useState<string>("list");
    const [groups, setGroups] = useState<any[]>([]);
    const [taxonGroups, setTaxonGroups] = useState<any[]>([]);
    const [datasetGroups, setDatasetGroups] = useState<any[]>([]);
    const [speciesListGroups, setSpeciesListGroups] = useState<any[]>([]);
    const [dataProjectGroups, setDataProjectGroups] = useState<any[]>([]);
    const [environmentalLayerGroups, setEnvironmentalLayerGroups] = useState<any[]>([]);
    const [regionLocalityGroups, setRegionLocalityGroups] = useState<any[]>([]);
    const [alaGeneralContentGroups, setAlaGeneralContentGroups] = useState<any[]>([]);
    const [helpArticlesGroups, setHelpArticlesGroups] = useState<any[]>([]);

    const navigate = useNavigate();

    type MappingType = {
        [key: string]: string | undefined;
    };

    const groupMapping: MappingType = {
        "TAXON": "Species",
        "LAYER": "Environmental Layers",
        "REGION": "Regions/localities",
        "LOCALITY": "Regions/localities",
        "DATARESOURCE": "Datasets",
        "DATAPROVIDER": "Datasets",
        "COLLECTION": "Datasets",
        "INSTITUTION": "Datasets",
        "SPECIESLIST": "Species List",
        "WORDPRESS": "ALA General Content",
        "KNOWLEDGEBASE": "Help Articles",
        "COMMON": "Species",
        "IDENTIFIER": "Species",
        "TAXONVARIANT": "Species",
        "BIOCOLLECT": "Data Projects",
        "DISTRIBUTION": undefined
    };

    const groupFq: MappingType = {
        "Species": "idxtype:TAXON", // TODO: are these also required? OR idxtype:COMMON OR idxtype:IDENTIFIER OR idxtype:TAXONVARIANT",
        "Environmental Layers": "idxtype:LAYER",
        "Regions/localities": "idxtype:REGION OR idxtype:LOCALITY",
        "Datasets": "idxtype:DATARESOURCE", // TODO: are these also required? OR idxtype:DATAPROVIDER OR idxtype:COLLECTION OR idxtype:INSTITUTION",
        "Species List": "idxtype:SPECIESLIST",
        "ALA General Content": "idxtype:WORDPRESS",
        "Help Articles": "idxtype:KNOWLEDGEBASE",
        "Data Projects": "idxtype:BIOCOLLECT"
    };

    useEffect(() => {
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) + "&facets=idxtype&pageSize=0")
            .then(response => response.json())
            .then(data => {
                var searchGroups: { [key: string]: { count: number, label: string, items: any[] } } = {
                    "Species": {count: 0, label: "Species", items: []},
                    "Datasets": {count: 0, label: "Datasets", items: []},
                    "Species List": {count: 0, label: "Species List", items: []},
                    "Data Projects": {count: 0, label: "Data Projects", items: []},
                    "Environmental Layers": {count: 0, label: "Environmental Layers", items: []},
                    "Regions/localities": {count: 0, label: "Regions/localities", items: []},
                    "ALA General Content": {count: 0, label: "ALA General Content", items: []},
                    "Help Articles": {count: 0, label: "Help Articles", items: []}
                }
                if (data?.facetResults && data.facetResults[0] && data.facetResults[0].fieldResult) {
                    data.facetResults[0].fieldResult.forEach((facet: any) => {
                        var group: string | undefined = groupMapping[facet.label];
                        if (group) {
                            searchGroups[group].count = searchGroups[group].count + facet.count;
                        }
                    })
                }

                // reset lists
                setTaxonGroups([])
                setDatasetGroups([])
                setSpeciesListGroups([])
                setDataProjectGroups([])
                setEnvironmentalLayerGroups([])
                setRegionLocalityGroups([])
                setAlaGeneralContentGroups([])
                setHelpArticlesGroups([])

                // fetch the first 4 results for each
                Object.values(searchGroups).forEach((group: any) => {
                    if (group.count > 0) {
                        fetch(import.meta.env.VITE_APP_BIE_URL +
                            "/v2/search?q=" + encodeURIComponent(queryString as string) +
                            "&pageSize=4&fq=" + encodeURIComponent(groupFq[group.label] || ""))
                            .then(response => response.json())
                            .then(data => {
                                if (data?.searchResults) {
                                    var list: any [] = []
                                    data.searchResults.forEach((result: any) => {
                                        list.push(result)
                                    })
                                    if (group.label == "Species") {
                                        setTaxonGroups(list)
                                    } else if (group.label == "Datasets") {
                                        setDatasetGroups(list)
                                    } else if (group.label == "Species List") {
                                        setSpeciesListGroups(list)
                                    } else if (group.label == "Data Projects") {
                                        setDataProjectGroups(list)
                                    } else if (group.label == "Environmental Layers") {
                                        setEnvironmentalLayerGroups(list)
                                    } else if (group.label == "Regions/localities") {
                                        setRegionLocalityGroups(list)
                                    } else if (group.label == "ALA General Content") {
                                        setAlaGeneralContentGroups(list)
                                    } else if (group.label == "Help Articles") {
                                        setHelpArticlesGroups(list)
                                    }
                                }
                            }).catch((error) => {
                            console.error(error)
                        });
                    }
                })

                console.log(Object.values(searchGroups))
                setGroups(Object.values(searchGroups))
            }).catch((error) => {
            console.error(error)
        });
    }, [queryString]);

    function updateFilter(filterName: string) {
        setFilter(filterName)
    }

    return (<>
            <Flex gap="15px">
                <Text style={{lineHeight: "36px"}}>View as</Text>
                <Button variant="ala-filter" onClick={() => {
                    updateFilter("list")
                }}
                        className={(filter == "list") ? classes.activeFilter : classes.disabledFilter}
                >
                    <ListIcon color="#637073"/>List</Button>
                <Button onClick={() => updateFilter("tiles")} variant="ala-filter"
                        className={(filter == "tiles") ? classes.activeFilter : classes.disabledFilter}
                >
                    <TilesIcon color="#637073"/>Tiles</Button>
            </Flex>
            {groups.map((group, index) =>
                <Fragment key={index}>
                    {group.count > 0 && <>
                        <Space h="60px"/>
                        <Flex style={{justifyContent: 'space-between'}}>
                            <Text className={classes.groupName}>{group.label}</Text>
                            <Anchor className={classes.groupCount}
                            >See {group.count} results <ArrowRightIcon/></Anchor>
                        </Flex>
                        <Space h="30px"/>
                        {filter == "list" && <>
                            {group.label == "Species" && taxonGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {speciesDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Datasets" && datasetGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {datasetsDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Species List" && speciesListGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {specieslistDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Data Projects" && dataProjectGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {dataprojectsDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Environmental Layers" && environmentalLayerGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {environmentallayersDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Regions/localities" && regionLocalityGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {regionslocalitiesDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "ALA General Content" && alaGeneralContentGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {wordpressDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Help Articles" && helpArticlesGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {supportDefn.renderListItemFn({item, navigate})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                        </>}
                        {filter == "tiles" &&
                            <Grid gutter="40px">
                                {group.label == "Species" && taxonGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {speciesDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Datasets" && datasetGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {datasetsDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Species List" && speciesListGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {specieslistDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Data Projects" && dataProjectGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {dataprojectsDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Environmental Layers" && environmentalLayerGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {environmentallayersDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Regions/localities" && regionLocalityGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {regionslocalitiesDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "ALA General Content" && alaGeneralContentGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {wordpressDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                                {group.label == "Help Articles" && helpArticlesGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {supportDefn.renderTileItemFn({item, navigate})}
                                    </Grid.Col>
                                )}
                            </Grid>
                        }
                    </>
                    }
                </Fragment>
            )}
        </>
    )
}

export default AllView;
