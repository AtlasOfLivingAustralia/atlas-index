import {Fragment, useEffect, useState} from "react";
import {Anchor, Button, Divider, Flex, Grid, Space, Text} from "@mantine/core";
import classes from "./search.module.css";
import {ListIcon, TilesIcon, ArrowRightIcon} from '@atlasoflivingaustralia/ala-mantine';
import {useNavigate} from "react-router-dom";
import {speciesDefn} from "./props/speciesDefn.tsx";
import {datasetsDefn} from "./props/datasetsDefn.tsx";
import {dataprojectsDefn} from "./props/dataprojectsDefn.tsx";
import {specieslistDefn} from "./props/specieslistDefn.tsx";
import {environmentallayersDefn} from "./props/environmentallayersDefn.tsx";
import {regionslocalitiesDefn} from "./props/regionslocalitiesDefn.tsx";
import {wordpressDefn} from "./props/wordpressDefn.tsx";
import {supportDefn} from "./props/supportDefn.tsx";

interface ViewProps {
    queryString?: string | undefined
    setTab: (tab: string) => void
}

function AllView({queryString, setTab}: ViewProps) {
    const [filter, setFilter] = useState<string>("list");
    const [groups, setGroups] = useState<any[]>([]);
    const [total, setTotal] = useState<number>(0);
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
        "SPECIESLIST": "Species List",
        "WORDPRESS": "ALA General Content",
        "KNOWLEDGEBASE": "Help Articles",
        "COMMON": "Species",
        "BIOCOLLECT": "Data Projects",
        "DIGIVOL": "Volunteer Projects",
        "DISTRIBUTION": undefined
    };

    const groupFq: MappingType = {
        "Species": "idxtype:TAXON OR idxtype:COMMON",
        "Environmental Layers": "idxtype:LAYER",
        "Regions/localities": "idxtype:REGION OR idxtype:LOCALITY",
        "Datasets": "idxtype:DATARESOURCE",
        "Species List": "idxtype:SPECIESLIST",
        "ALA General Content": "idxtype:WORDPRESS",
        "Help Articles": "idxtype:KNOWLEDGEBASE",
        "Data Projects": "idxtype:BIOCOLLECT OR idxtype:DIGIVOL"
    };

    useEffect(() => {
        // reset groups
        setGroups([])

        // reset total
        setTotal(0)

        // reset lists
        setTaxonGroups([])
        setDatasetGroups([])
        setSpeciesListGroups([])
        setDataProjectGroups([])
        setEnvironmentalLayerGroups([])
        setRegionLocalityGroups([])
        setAlaGeneralContentGroups([])
        setHelpArticlesGroups([])

        if (!queryString) {
            console.log("No query string")
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) + "&facets=idxtype&pageSize=0")
            .then(response => response.json())
            .then(data => {
                var searchGroups: { [key: string]: { count: number, label: string, items: any[], tabName: string } } = {
                    "Species": {count: 0, label: "Species", items: [], tabName: "species"},
                    "Datasets": {count: 0, label: "Datasets", items: [], tabName: "datasets"},
                    "Species List": {count: 0, label: "Species List", items: [], tabName: "specieslists"},
                    "Data Projects": {count: 0, label: "Data Projects", items: [], tabName: "dataprojects"},
                    "Environmental Layers": {count: 0, label: "Environmental Layers", items: [], tabName: "environmentallayers"},
                    "Regions/localities": {count: 0, label: "Regions/localities", items: [], tabName: "regionslocalities"},
                    "ALA General Content": {count: 0, label: "ALA General Content", items: [], tabName: "alageneralcontent"},
                    "Help Articles": {count: 0, label: "Help Articles", items: [], tabName: "helparticles"}
                }
                if (data?.facetResults && data.facetResults[0] && data.facetResults[0].fieldResult) {
                    data.facetResults[0].fieldResult.forEach((facet: any) => {
                        var group: string | undefined = groupMapping[facet.label];
                        if (group) {
                            searchGroups[group].count = searchGroups[group].count + facet.count;
                        }
                    })
                }

                setTotal(data.totalRecords)

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
            {total == 0 && <Text mt={60}>No results found</Text>}
            {groups.map((group, index) =>
                <Fragment key={index}>
                    {group.count > 0 && <>
                        <Space h="60px"/>
                        <Flex style={{justifyContent: 'space-between'}}
                            onClick={() => setTab(group.tabName)}>
                            <Text className={classes.groupName}>{group.label}</Text>
                            <Anchor className={classes.groupCount}
                            >See {group.count} results <ArrowRightIcon/></Anchor>
                        </Flex>
                        <Space h="30px"/>
                        {filter == "list" && <>
                            {group.label == "Species" && taxonGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {speciesDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Datasets" && datasetGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {datasetsDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Species List" && speciesListGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {specieslistDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Data Projects" && dataProjectGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {dataprojectsDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Environmental Layers" && environmentalLayerGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {environmentallayersDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Regions/localities" && regionLocalityGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {regionslocalitiesDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "ALA General Content" && alaGeneralContentGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {wordpressDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                            {group.label == "Help Articles" && helpArticlesGroups.map((item: any, index: number) =>
                                <Fragment key={index}>
                                    {index > 0 && <Space h="10px"/>}
                                    {supportDefn.renderListItemFn({item, navigate, wide: true})}
                                    <Divider mt="15px"/>
                                </Fragment>
                            )}
                        </>}
                        {filter == "tiles" &&
                            <Grid gutter="40px">
                                {group.label == "Species" && taxonGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {speciesDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Datasets" && datasetGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {datasetsDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Species List" && speciesListGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {specieslistDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Data Projects" && dataProjectGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {dataprojectsDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Environmental Layers" && environmentalLayerGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {environmentallayersDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Regions/localities" && regionLocalityGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {regionslocalitiesDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "ALA General Content" && alaGeneralContentGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {wordpressDefn.renderTileItemFn({item, navigate, wide: true})}
                                    </Grid.Col>
                                )}
                                {group.label == "Help Articles" && helpArticlesGroups.map((item: any, index: number) =>
                                    <Grid.Col span={3} key={index}>
                                        {supportDefn.renderTileItemFn({item, navigate, wide: true})}
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
