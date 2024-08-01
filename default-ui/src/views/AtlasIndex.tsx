import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
// import {AsyncTypeahead, Menu, MenuItem} from "react-bootstrap-typeahead";
// import {Modal, Tab, Tabs} from "react-bootstrap";

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

    return (
        <>
            <>
                <div className="container-fluid">
                    <div className="d-flex w-100">
                        <AsyncTypeahead className="w-50"
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
                                            <Menu {...menuProps}>
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
                        <button className="btn btn-primary" onClick={() => search()}>Search</button>
                        <div>{lastSearch}</div>
                    </div>

                    <br/>
                    <Tabs
                        id="admin-tabs"
                        activeKey={tab}
                        onSelect={(k) => setTab("" + k)}
                        className=""
                    >
                        <Tab eventKey="list" title="Search Result">
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
                        </Tab>
                        <Tab eventKey="facet" title="Facet List">
                            {facetJSON && <pre><small>{facetJSON}</small></pre>}
                        </Tab>
                        <Tab eventKey="species" title="TAXON JSON">
                            {itemJSON && <pre><small>{itemJSON}</small></pre>}
                        </Tab>
                    </Tabs>
                </div>

                <Modal show={show} onHide={handleClose}>
                    <Modal.Header closeButton>
                        <Modal.Title>External Link</Modal.Title>
                    </Modal.Header>
                    <Modal.Body><a target="_blank" href={modalUrl}>{modalUrl}</a></Modal.Body>
                    <Modal.Footer>
                        <button className="btn" onClick={handleClose}>
                            Close
                        </button>
                    </Modal.Footer>
                </Modal>
            </>

        </>
    )
}

export default AtlasIndex;
