/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import DoiForm from "../components/doi/doiForm.tsx";
import Menu from '../components/menu.tsx';
import {Breadcrumb, Pagination} from '@ala/common-ui';
import {useAuth} from "react-oidc-context";
import {Tab, Tabs} from "react-bootstrap";
import JsonViewer from '../components/jsonViewer';

function Doi({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {
    const [tab, setTab] = useState('list');

    const [doiId, setDoiId] = useState<string | null>(null);
    const [doiData, setDoiData] = useState<any>(null);
    const [doiRecord, setDoiRecord] = useState<string | null>(null);
    const [includeProviderRecord, setIncludeProviderRecord] = useState(false);

    const [loading, setLoading] = useState(true);
    const [doiList, setDoiList] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [maxResults, setMaxResults] = useState(0);
    const pageSize = 100;

    const auth = useAuth();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'DOI', href: '/'},
        ]);
    }, []);

    useEffect(() => {
        getList();
    }, [page]);

    const getList = () => {
        setLoading(true);
        setDoiList([]);
        // Fetch recent DOIs from the server
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v1/doi?offset=' + (page * pageSize) + '&max=' + pageSize + "&sort=dateCreated&order=desc", {
            method: 'GET'
        }).then((response) => {
            response.json().then((json) => {
                if (response.ok) {
                    const totalCount = response.headers.get('x-total-count');
                    setMaxResults(totalCount ? parseInt(totalCount, 10) : 0);
                    setDoiList(json);
                }
            });
        }).finally(() => {
            setLoading(false);
        })
    }

    const getDoi = (newDoiId?: string) => {
        setDoiRecord(null);
        setDoiData(null);

        let id = newDoiId || doiId;

        // Fetch DOI data from the server
        if (!id) {
            alert('Please enter a DOI');
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v1/doi/' + id, {
            method: 'GET'
        }).then((response) => {
            response.json().then((json) => {
                if (response.ok) {
                    setDoiData(json);

                    // Now fetch the provider record
                    if (includeProviderRecord) {
                        fetch("https://api.test.datacite.org/dois/" + id, {
                            method: 'GET'
                        }).then((response) => {
                            response.json().then((json) => {
                                if (response.ok) {
                                    setDoiRecord(json);
                                } else {
                                    alert('Error fetching DOI data: ' + json.message);
                                }
                            });
                        });
                    }
                } else {
                    alert('Error fetching DOI data: ' + json.message);
                }
            });
        });
    }

    function updatePage(newPage: number) {
        window.scrollTo({top: 0, behavior: 'smooth'});
        setPage(() => newPage);
        setLoading(true);
        getList();
    }

    function mintDoiRequest(values: any) {
        const body = {
            provider: "DATACITE",
            userId: values.userId,
            providerMetadata: JSON.parse(values.providerMetadata),
            title: values.title,
            authors: values.authors,
            description: values.description,
            licence: values.licence,
            applicationUrl: values.applicationUrl,
            fileUrl: values.fileUrl,
            applicationMetadata: values.applicationMetadata ? JSON.parse(values.applicationMetadata) : null,
            customLandingPageUrl: values.customLandingPageUrl,
        };

        try {
            fetch(import.meta.env.VITE_APP_BIE_URL + '/v1/doi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.user?.access_token },
                body: JSON.stringify(body)
            })
            .then(response => response.json().then(result => {
                if (response.ok) {
                    console.log('DOI minted:', result);
                    alert('DOI minted: ' + JSON.stringify(result));
                    // get x-doi-id header
                    const doiId = response.headers.get('x-doi-id');
                    console.log('DOI ID:', doiId);
                    alert('DOI ID: ' +  doiId);

                    // handle success (e.g., show message, update state)
                } else {
                    console.error('Error minting DOI:', result);
                    // handle error (e.g., show error message)
                    alert('Error minting DOI: ' + JSON.stringify(result));
                }
            }))
            .catch(err => {
                console.error('Network error:', err);
                // handle network error
                alert('Network error: ' + err);
            });
        } catch (err) {
            console.error('Network error:', err);
            // handle network error
            alert('Network error: ' + err);
        }
    }

    return (
        <>
            <div className="d-flex flex-row">
                <Menu/>
                <div style={{flex: 1, padding: '20px'}}>
                    <Tabs id="admin-tabs" activeKey={tab} onSelect={(k) => setTab('' + k)}>
                        <Tab eventKey="create" title="Mint DOI">
                            <div style={{margin: '20px'}}>
                                <div className="row">
                                    <div className="col-md-6">
                                        <DoiForm onSubmit={values => {
                                            mintDoiRequest(values);
                                        }} />
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light border rounded mt-5 ms-3">
                                            <h5>Instructions</h5>
                                            <p>
                                                Please fill out the form to create or update a DOI. Fields marked as optional can be left blank.
                                            </p>
                                            <p>
                                                <strong>Provider Metadata Example:</strong>
                                            </p>
                                            <pre>
{`{
    "authors" : [
        "<Author>"
    ],
    "contributors" : [{
            "name" : "<Contributor>",
            "type" : "<Editor|etc>"
        }
    ],
    "title" : "<Title>",
    "subjects" : [
        "<Subjects>"
    ],
    "subtitle" : "<Subtitle>",
    "publicationYear" : <Year>,
    "createdDate" : "YYYY-MM-ddThh:mm:ssZ",
    "descriptions" : [{
            "text" : "<Description>",
            "type" : "<Other|etc>"
        }
    ],
    "resourceText" : "<Species information|etc>",
    "resourceType" : "<Text|etc>",
    "publisher" : "<Publisher>"
}`}
                                                      </pre>
                                            <p>
                                                <strong>Application Metadata Example:</strong>
                                            </p>
                                            <pre>
{`{
  "datasets": []
  "searchUrl": "..."
  "recordCount": "123456"
}`}
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </Tab>
                        <Tab eventKey="show" title="Show data for a DOI">
                            <div className="mb-2 gap-2 mt-5">
                                <div className="d-flex">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="DOI (e.g. 10.12345/ala.00000111)"
                                        value={doiId ?? ''}
                                        onChange={e => {
                                            setDoiId(e.target.value || null);
                                        }}
                                        style={{width: 400}}
                                    />
                                    <div>
                                    <button className="btn btn-primary" onClick={() => getDoi()}>Search</button>
                                    <input type="checkbox" checked={includeProviderRecord} className="ms-5"
                                           onChange={e => setIncludeProviderRecord(e.target.checked)}/>
                                    <label htmlFor="includeProviderRecord" className={"ps-2"}>Include findable provider record on search</label>
                                    </div>
                                </div>
                                <div style={{ color: 'gray', marginTop: '10px' }}>
                                    e.g 10.80416/ala.36942877-de8a-4b90-96ea-7cc59b9d5583 (test environment)
                                </div>

                                <br/>
                                <hr/>

                                <h4>ALA record</h4>
                                {doiData && (
                                  <pre style={{border: "1px solid black", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all"}}>
                                      <JsonViewer data={doiData} />
                                  </pre>
                                )}
                                <br/>
                                <hr/>

                                { includeProviderRecord && <>
                                    <h4>Provider record</h4>
                                    {doiRecord && (
                                        <pre style={{border: "1px solid black", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all"}}>
                                          <JsonViewer data={doiRecord} />
                                      </pre>
                                    )}
                                </>}
                            </div>

                        </Tab>
                        <Tab eventKey="list" title="Recent DOIs">
                            <div className="mb-2 gap-2 m-3">
                                { loading && <div>Loading...</div> }
                                { !loading && <>
                                    <table className="table table-striped">
                                        <thead>
                                        <tr>
                                            <th>DOI</th>
                                            <th>Title</th>
                                            <th>Created</th>
                                            <th>Created By</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {doiList.map((doi, idx) => (
                                            <tr key={idx} style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setTab('show');
                                                    setDoiId(doi.doi);
                                                    getDoi(doi.doi);
                                                }}>
                                                <td>{doi.doi}</td>
                                                <td>{doi.title}</td>
                                                <td>{new Date(doi.dateCreated).toLocaleString()}</td>
                                                <td>{doi.userId || 'N/A'}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </>}
                                <Pagination page={page} maxResults={maxResults} pageSize={pageSize}
                                            deepPagingMaxPage={10000} onPageChange={updatePage} isMobile={false}/>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </>
    );
}

export default Doi;
