import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {Alert, Anchor, Box, Button, Container, Divider, Flex, Grid, Image, Skeleton, Space, Text} from "@mantine/core";
import {IconInfoCircleFilled} from "@tabler/icons-react";
import classes from "./search.module.css";
import FormatName from "../nameUtils/formatName.tsx";
import {FlagIcon, ListIcon, TilesIcon, ArrowRightIcon, FolderIcon} from '@atlasoflivingaustralia/ala-mantine';
import { useNavigate } from "react-router-dom";



interface ViewProps {
    queryString?: String | undefined
}

function ClassificationView({queryString}: ViewProps) {
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

    const groupMapping = {
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
    }

    const groupFq = {
        "Species": "idxtype:TAXON OR idxtype:COMMON OR idxtype:IDENTIFIER OR idxtype:TAXONVARIANT",
        "Environmental Layers": "idxtype:LAYER",
        "Regions/localities": "idxtype:REGION OR idxtype:LOCALITY",
        "Datasets": "idxtype:DATARESOURCE OR idxtype:DATAPROVIDER OR idxtype:COLLECTION OR idxtype:INSTITUTION",
        "Species List": "idxtype:SPECIESLIST",
        "ALA General Content": "idxtype:WORDPRESS",
        "Help Articles": "idxtype:KNOWLEDGEBASE",
        "Data Projects": "idxtype:BIOCOLLECT"
    }

    useEffect(() => {
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) + "&facets=idxtype&pageSize=0")
            .then(response => response.json())
            .then(data => {
                var searchGroups = {
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
                        var group = groupMapping[facet.label];
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
                        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/search?q=" + encodeURIComponent(queryString as string) + "&pageSize=4&fq=" + encodeURIComponent(groupFq[group.label]))
                            .then(response => response.json())
                            .then(data => {
                                if (data?.searchResults) {
                                    var list = []
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

    function formatWordpressCategory(category: string) {
        if (!category) {
            return category;
        }
        return category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function formatListType(type: string) {
        if (!type) {
            return type;
        }
        return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const getImageThumbnailUrl = (id: string) => {
        // TODO: enable the following later on: return `${import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL}${id}`;
        return `https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=${id}`;
    }

    const renderSpecies = (item: any) => {
        return <Flex gap="30px" style={{cursor: "pointer"}} onClick={() => openSpeciesUrl(item.guid)} >
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image &&
                <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={getImageThumbnailUrl(item.image)}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}><FormatName name={item.scientificName || item.name}
                                                                   rankId={item.rankID}/></Text>
                <Text>{item.commonNameSingle}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                {item.speciesGroup && <Text>{item.speciesGroup.join(', ')}</Text>}
                {item?.data?.rk_kingdom && <Text>Kingdom: {item?.data?.rk_kingdom}</Text>}
                <Text><FolderIcon/> {item.occurrenceCount ? item.occurrenceCount : 0} occurrence records</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                {/*<Text>Short description lorem ipsum dolor sit amet consectetur adipiscing elit aliquam id dapibus ipsum.*/}
                {/*    Aliquam in orci quis tortor rutrum laoreet in id sapien nulla eu...</Text>*/}
            </div>
        </Flex>
    }

    function openUrl(url: string){
        window.open(url, "_blank");
    }

    function openSpeciesUrl(guid: string){
        navigate(`/species?id=${guid}`);
    }

    function openRegionLocality(pid: string, description: string){
        // test description, if it ends with "latitude longitude" then open explore your area
        // otherwise, open regions.ala.org.au with the pid, or at least try to.
    }

    const renderDatasets = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                    />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text><FolderIcon/> contains {item.occurrenceCount} records</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderSpeciesList = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "342px", maxWidth: "342px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
                <Text>{formatListType(item.type)}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text><FolderIcon/> contains {item.itemCount} taxa</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderDataProjects = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                {/*<Text><FolderIcon/> contains {item.occurrenceCount} records</Text>*/}
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderEnvironmentalLayer = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.overflowText} title={item.keywords}>{item.keywords}</Text>
                <Text className={classes.overflowText} title={item.source}>{item.source}</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderRegionLocalities = (item: any) => {
        return <Flex gap="30px" onClick={() => openRegionLocality(item.pid, item.description)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "342px", maxWidth: "342px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text>{item.fieldName}</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderALAGeneralContent = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "62px", minHeight: "62px"}}>
                {item.image && <Image
                    radius="5px"
                    mah={62}
                    maw={62}
                    src={item.image}
                    onError={(e) => e.currentTarget.src = "../../../public/missing-image.png"}
                />
                }
                {!item.image &&
                    <Image
                        radius="5px"
                        mah={62}
                        maw={62}
                        src="../../../public/missing-image.png"
                    />
                }
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                <Text>{formatWordpressCategory(item.classification1)}</Text>
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    const renderHelpArticles = (item: any) => {
        return <Flex gap="30px" onClick={() => openUrl(item.guid)} style={{cursor: "pointer"}}>
            <div style={{minWidth: "342px", maxWidth: "342px"}}>
                <Text className={classes.listItemName}>{item.name}</Text>
            </div>
            <div style={{minWidth: "250px", maxWidth: "250px"}}>
                {item.classification1 && <Text>{item.classification1}</Text>}
                {item.classification2 && <Text>{item.classification2}</Text>}
            </div>
            <div style={{minWidth: "500px", maxWidth: "500px"}}>
                <Text title={item.description}>{limitDescription(item.description)}</Text>
            </div>
        </Flex>
    }

    function limitDescription(description: string) : string {
        if(description && description.length > 230) {
            return description.substring(0, 230) + "...";
        }
        return description;
    }

    return (<>
            <Flex gap="15px">
                <Text style={{lineHeight: "36px"}}>View
                    as</Text> {/* this line height matches that of the ala-filter button */}
                <Button variant={filter == "list" ? "filled" : "outline"} className={classes.filterButton}
                        onClick={() => setFilter("list")}>
                    <ListIcon/>List</Button>
                <Button variant={filter == "tiles" ? "filled" : "outline"} className={classes.filterButton}
                        onClick={() => setFilter("tiles")}>
                    <TilesIcon/>Tiles</Button>
            </Flex>
            {groups.map((group, index) =>
                <>
                    { group.count > 0 && <>
                        <Space h="60px"/>
                        <Flex style={{justifyContent: 'space-between'}}>
                            <Text className={classes.groupName}>{group.label}</Text>
                            <Anchor className={classes.groupCount}
                            >See {group.count} results <ArrowRightIcon/></Anchor>
                        </Flex>
                        <Space h="30px"/>
                        {group.label == "Species" && taxonGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderSpecies(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Datasets" && datasetGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderDatasets(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Species List" && speciesListGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderSpeciesList(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Data Projects" && dataProjectGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderDataProjects(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Environmental Layers" && environmentalLayerGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderEnvironmentalLayer(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Regions/localities" && regionLocalityGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderRegionLocalities(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "ALA General Content" && alaGeneralContentGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderALAGeneralContent(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                        {group.label == "Help Articles" && helpArticlesGroups.map((item: any, index: number) =>
                            <>
                                {index > 0 && <Space h="10px"/>}
                                {renderHelpArticles(item)}
                                <Divider mt="15px"/>
                            </>
                        )}
                    </>
                    }
                </>
            )}
        </>
    )
}

export default ClassificationView;
