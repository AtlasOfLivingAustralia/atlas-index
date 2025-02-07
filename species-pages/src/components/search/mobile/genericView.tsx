import {Grid, Text, Skeleton, Space, Box, Flex, Button, Select, Divider, Modal} from '@mantine/core';
import CheckIcon from "../../common/checkIcon.tsx";
import CheckDisabledIcon from "../../common/checkDisabledIcon.tsx";
import CheckedIcon from "../../common/checkedIcon.tsx";
import FilterIcon  from "../../common/filterIcon.tsx";
import {
    ChevronDownIcon,
    ListIcon,
    TilesIcon
} from '@atlasoflivingaustralia/ala-mantine';
import classes from "../search.module.css";
import {useState} from "react";

interface RefineResultsProps {
    facets: any[];
    customFacetData: any[];
    facetLoading: boolean;
    customFacetLoading: boolean;
    toggleItem: (item: any) => void;
    loading: boolean;
    maxResults: number;
    page: number;
    pageSize: number;
    queryString: string;
    filter: string;
    setFilter: (filter: string) => void;
    sortData: any[];
    sortValue: string;
    setSortValue: (value: string) => void;
    getResults: (params: any, refresh: boolean) => void;
    resultData: any[];
    renderListItemFn: (props: { item: any; navigate: any; wide: boolean }) => JSX.Element;
    renderTileItemFn: (props: { item: any; navigate: any; wide: boolean }) => JSX.Element;
    navigate: any;
    deepPagingMaxPage: number;
    updatePage: (page: number) => void;
}

const genericResultView: React.FC<RefineResultsProps> = ({
                                                         facets,
                                                         customFacetData,
                                                         facetLoading,
                                                         customFacetLoading,
                                                         toggleItem,
                                                         loading,
                                                         maxResults,
                                                         page,
                                                         pageSize,
                                                         queryString,
                                                         filter,
                                                         setFilter,
                                                         sortData,
                                                         sortValue,
                                                         setSortValue,
                                                         getResults,
                                                         resultData,
                                                         renderListItemFn,
                                                         renderTileItemFn,
                                                         navigate,
                                                         deepPagingMaxPage,
                                                         updatePage,
                                                     }) => {
    const [opened, setOpened] = useState(false);

    return (
        <Flex direction="column" gap="md" className={classes.mobile}>
            {/* Facets Section */}
            { facets.length > 0 && <>
                <Button
                    onClick={() => setOpened(true)}>
                    {<Flex align="center" gap="10px"><FilterIcon/><Text>Refine Results</Text></Flex>}
                </Button>

                <Modal
                    opened={opened}
                    onClose={() => setOpened(false)}
                    title={ <Flex align="center" gap="10px"><FilterIcon /><Text>Refine Results</Text></Flex> }
                    size="lg"
                    styles={{
                        header: { borderBottom: "1px solid #ddd", paddingBottom: "10px" }, // Adds a line under the title
                        title: { width: "100%", textAlign: "center" }, // Ensures title is centered
                    }}
                >

                    {(facetLoading || customFacetLoading) && <Skeleton mt={15} height="100px" />}
                         {!facetLoading &&
                            !customFacetLoading &&
                             [...facets, ...customFacetData]
                        .sort((a, b) => a.order - b.order)
                        .map((facet, index) => (
                            <Box key={index}>
                                <Space h="15px" />
                                <Text className={classes.refineSectionTitle}>{facet.name}</Text>
                                <Space h="10px" />
                                {facet.items &&
                                    facet.items.map((item : any, idx : number) => (
                                        <div key={idx}>
                                            {idx > 0 && <Space h="6px" />}
                                            <Flex
                                                gap="6px"
                                                style={{ cursor: !item.selected && item.count === 0 ? 'auto' : 'pointer' }}
                                                ml={22 * item.depth}
                                            >
                                                {!item.selected && item.count > 0 && (
                                                    <CheckIcon size="16" onClick={() => toggleItem(item)} />
                                                )}
                                                {!item.selected && item.count === 0 && <CheckDisabledIcon size="16" />}
                                                {item.selected && <CheckedIcon size="16" onClick={() => toggleItem(item)} />}
                                                <Text fz={14}>
                                                    {item.label} ({item.count})
                                                </Text>
                                            </Flex>
                                        </div>
                                    ))}
                            </Box>
                        ))}
                </Modal>
            </>} {/* End of facets filter */}

            {/* Results Section */}
            <Box>
                {loading && <Skeleton height="28px" />}
                {!loading && (
                    <Flex wrap="wrap" gap="sm">
                        <Text className={classes.resultsTitle}>Showing&nbsp;</Text>
                        {maxResults > 0 && (
                            <Text className={classes.resultsTitleBold}>
                                {page * pageSize + 1}-{maxResults < (page + 1) * pageSize ? maxResults : (page + 1) * pageSize}
                            </Text>
                        )}
                        {maxResults > 0 && <Text className={classes.resultsTitle}>&nbsp;of&nbsp;</Text>}
                        <Text className={classes.resultsTitleBold}>{maxResults}</Text>
                        <Text className={classes.resultsTitle}>&nbsp;results for&nbsp;</Text>
                        <Text className={classes.resultsTitleItalic}>{queryString}</Text>
                    </Flex>
                )}

                <Space h="30px" />
                <Flex direction="column" gap="md" style={{ justifyContent: 'space-between' }}>
                    <Flex gap="10px">
                        <Text style={{ lineHeight: '36px' }}>View as</Text>
                        <Button
                            variant="ala-filter"
                            onClick={() => setFilter('list')}
                            className={filter === 'list' ? classes.activeFilter : classes.disabledFilter}
                            style={{
                                height: '40px',
                                padding: '0 8px',  // Small padding to make the boundary close to text
                                display: 'inline-flex', // Make the button width fit its content
                                alignItems: 'center',  // Ensure vertical alignment of text and icon
                            }}
                        >
                            <ListIcon color="#637073" />
                            List
                        </Button>
                        <Button
                            onClick={() => setFilter('tiles')}
                            variant="ala-filter"
                            className={filter === 'tiles' ? classes.activeFilter : classes.disabledFilter}
                            style={{
                                height: '40px',
                                padding: '0 8px',  // Small padding to make the boundary close to text
                                display: 'inline-flex', // Make the button width fit its content
                                alignItems: 'center',  // Ensure vertical alignment of text and icon
                            }}
                        >
                            <TilesIcon color="#637073" />
                            Tiles
                        </Button>
                    </Flex>

                    <Flex gap="8px">
                        <Text style={{ lineHeight: '36px' }}>Sort by</Text>
                        <Select
                            className={classes.alaSelect}
                            data={sortData}
                            value={sortValue ?? "Sort by"}
                            onChange={(value) => {
                                setSortValue(value);
                                getResults({ sortParam: value }, false);
                            }}
                            rightSection={<ChevronDownIcon />}
                            comboboxProps={{ offset: 0 }}
                            withCheckIcon={false}
                            allowDeselect={false}
                            style={{
                                height: '40px',
                                padding: '0 8px',  // Small padding to make the boundary close to text
                                display: 'inline-flex', // Make the button width fit its content
                                alignItems: 'center',  // Ensure vertical alignment of text and icon
                            }}
                        />
                    </Flex>
                </Flex>

                <Space h="30px" />
                <Text className={classes.topResult}>Top Result</Text>
                <Space h="15px" />

                {loading && <Skeleton height={filter === 'list' ? '1185px' : '1595px'} />}
                {!loading && resultData.length === 0 && <Text>No results found</Text>}

                {!loading && (
                    <>
                        {filter === 'list' &&
                            resultData.map((item, index) => (
                                <>
                                    {index > 0 && <Space h="10px" />}
                                    {renderListItemFn({ item, navigate, wide: false })}
                                    <Divider mt="15px" />
                                </>
                            ))}
                        {filter === 'tiles' && (
                            <Grid gutter={40}>
                                {resultData.map((item, index) => (
                                    <Grid.Col span={12} key={index} >
                                        {renderTileItemFn({ item, navigate, wide: false })}
                                    </Grid.Col>
                                ))}
                            </Grid>
                        )}
                    </>
                )}

                {/* Pagination */}
                {!facetLoading && !customFacetLoading && <>
                    <Space h="60px" />
                    <Flex justify="center" wrap={'wrap'} gap={10}>
                        {page > 2 && <>
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(0)}
                            >1
                            </button>
                            {page > 3 && <div>...</div>}
                        </>
                        }

                        {page - 1 > 0 && <button className={classes.paginationButton}
                                                 onClick={() => updatePage(page - 2)}>{page - 1}</button>}
                        {page > 0 && <button className={classes.paginationButton}
                                             onClick={() => updatePage(page - 1)}>{page}</button>}
                        <button className={classes.paginationButtonSelected} disabled={true}>{page + 1}</button>
                        {page + 1 < Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) &&
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(page + 1)}>{page + 2}</button>}
                        {page + 2 < Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) &&
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(page + 2)}>{page + 3}</button>}

                        {Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) > page + 3 && page < deepPagingMaxPage && <>
                            {Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) > page + 4 && <div>...</div>}
                            <button className={classes.paginationButton}
                                    onClick={() => updatePage(Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize)) - 1)}
                            >{Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize))}
                            </button>
                            <button className={`${classes.paginationButton} ${classes.next}`}
                                    onClick={() => updatePage(page + 1)}
                            > {'>'}
                            </button>
                        </>
                        }
                    </Flex>
                    </>
                }
            </Box>
        </Flex>
    );
};

export default genericResultView;