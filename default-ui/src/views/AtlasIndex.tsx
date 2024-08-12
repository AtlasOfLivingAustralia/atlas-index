import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {AsyncTypeahead, Menu, MenuItem} from "react-bootstrap-typeahead";
import { Box, Container, Divider, Grid, Space, Tabs, TabsTab } from '@mantine/core';
import classes from '../desktop.module.css';
// import {Modal, Tab, Tabs} from "react-bootstrap";
// import { Autocomplete } from '@mantine/core'; // See https://mantine.dev/combobox/?e=AsyncAutocomplete

function AtlasIndex({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [state, setState] = useState({
        isLoading: false,
        options: [],
        query: '',
    });
    const [resultList, setResultList] = useState<any[]>([]);
    // const [searchQuery, setSearchQuery] = useState('');
    const [tab, setTab] = useState('list');
    const [itemJSON, setItemJSON] = useState('');
    const [facetJSON, setFacetJSON] = useState('');
    const [lastSearch, setLastSearch] = useState('');
    const [selectedOption, setSelectedOption] = useState<any[]>([]);

    // modal
    const [show, setShow] = useState(false);
    const [modalUrl, setModalUrl] = useState('');
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Atlas Index', href: '/atlas-index'},
        ]);
    }, []);

    function search() {
        setResultList([]);
        setFacetJSON('')

        let searchTerm = selectedOption.length > 0 ? selectedOption[0].name : state.query;

        setLastSearch(searchTerm);

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/list?q=' + encodeURI(searchTerm) + "&fl=name,id,guid,idxtype,taxonomicStatus&pageSize=30&facets=taxonomicStatus,idxtype")
            .then(resp => resp.json())
            .then(json => {
                setResultList(json.list);
                setFacetJSON(JSON.stringify(json.facets, null, 2))
                setTab('list');
            });
    }

    function showItem(item: any) {
        setItemJSON('')
        if (item.idxtype === 'TAXON' || item.idxtype === 'COMMON' || item.idxtype === 'IDENTIFIER' || item.idxtype === 'TAXONVARIANT') {
            setTab('species');

            fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/species', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([item.guid]),
            }).then(response => {
                response.json().then(json => {
                    setItemJSON(JSON.stringify(json, null, 2))
                });
            });
        } else {
            setModalUrl(item.guid);
            handleShow();
        }
    }

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || ''; 
        setTab(tabsTab);
    };

    return (
        <>
            <Box className={classes.header}>
                <Container size="lg">
                    <Space h="lg" />
                    <Grid gutter='0'>
                        <Grid.Col span={5}>
                            <AsyncTypeahead 
                                style={{ width: '100%' }}
                                id={"atlas-autocomplete"}
                                isLoading={state.isLoading}
                                selected={selectedOption}
                                placeholder="Search for a taxon, project, area, support article, etc"
                                onChange={(selected) => {
                                    setSelectedOption(selected);
                                }}
                                onSearch={(query) => {
                                    setState({
                                        isLoading: true,
                                        options: [],
                                        query: query,
                                    });
                                    fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/autocomplete?q=' + encodeURI(query) /*+ '&fq=idxtype:TAXON'*/)
                                        .then(resp => resp.json())
                                        .then(json => setState({
                                            isLoading: false,
                                            options: json,
                                            query: query,
                                        }));
                                }}
                                options={state.options}
                                renderMenu={(results, menuProps) => (
                                    <Menu {...menuProps} >
                                        {results.map((result, index) => (
                                            <MenuItem
                                                key={index}
                                                option={result}
                                                position={index}
                                                // Override href with the current route so clicking on an item does not change the route and the page does not scroll.
                                                href={"#/atlas-index"}>
                                                {/* @ts-ignore */}
                                                {result.name}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                            />
                        </Grid.Col>
                        <Grid.Col span={1}>
                            <button className="btn btn-primary" onClick={() => search()}>Search</button>
                        </Grid.Col>
                        <Grid.Col span={4}>{lastSearch}</Grid.Col>
                    </Grid>
                    <Space h="lg" />
                </Container>
            </Box>
            <Box>
                <Container size="lg">
                    <Tabs
                            id="admin-tabs"
                            defaultValue={tab}
                            onChange={handleTabChange}
                            className=""
                        >
                            {/* <Container size="lg"> */}
                                <Tabs.List>
                                    <Tabs.Tab value="list">Search Result</Tabs.Tab>
                                    <Tabs.Tab value="facet">Facets List</Tabs.Tab>
                                    <Tabs.Tab value="species">TAXON JSON</Tabs.Tab>
                                </Tabs.List>
                    </Tabs>
                </Container>
            </Box>
            <Divider />
            <Container size="lg">
                <Space h="lg" />
                {tab === 'list' && 
                    <div>
                        {resultList && resultList.map((item, index) => (
                            <div key={index} className="border-top d-flex">
                                <p><b>{item.name}</b> {item.idxtype}
                                    <i>{item.commonNameSingle} {item.taxonomicStatus} {item.guid}</i></p>
                                {/*<p className="font-monospace"><small>{JSON.stringify(item)}</small></p>*/}
                                <button className="btn border-black ms-auto" onClick={() => {
                                    showItem(item);
                                }}>show
                                </button>
                            </div>
                        ))}
                    </div>
                }
                {tab === 'facet' && facetJSON && <pre><small>{facetJSON}</small></pre>}
                {tab === 'species' && itemJSON && <pre><small>{itemJSON}</small></pre>}
                {/* <Modal show={show} onHide={handleClose}>
                    <Modal.Header closeButton>
                        <Modal.Title>External Link</Modal.Title>
                    </Modal.Header>
                    <Modal.Body><a target="_blank" href={modalUrl}>{modalUrl}</a></Modal.Body>
                    <Modal.Footer>
                        <button className="btn" onClick={handleClose}>
                            Close
                        </button>
                    </Modal.Footer>
                </Modal> */}
            </Container>
        </>
    )
}

export default AtlasIndex;
