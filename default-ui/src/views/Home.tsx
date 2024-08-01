import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import {Link} from "react-router-dom";
import {cacheFetchText} from "../helpers/CacheFetch.tsx";

function Home({setBreadcrumbs, login, logout}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    const [externalFooterHtml, setExternalFooterHtml] = useState('');
    const [userProperties, setUserProperties] = useState<string | null>();
    const [userKey, setUserKey] = useState<string>();
    const [userValue, setUserValue] = useState<string>();

    const [selectedFile, setSelectedFile] = useState();
    const [isFilePicked, setIsFilePicked] = useState(false);

    const alreadyLoaded: string[] = [];

    function getUserProperties() {
        const prop = (userKey) ? "&name=" + userKey : '';
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property?alaId=" + currentUser.userId() + prop, {
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
            }
        }).then(response => {
            response.json().then(json => {
                setUserProperties(JSON.stringify(json));
            })
        });
    }

    function loadText(text: string) {
        var srcUrl;
        var srcText;
        var script1 = text.match(/(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>)/g);
        if (script1 && script1.length > 0) {
            text = text.replace(script1[0], "");
            var srcMatches = script1[0].match(/src=["']([^'"]*)/)
            if (srcMatches && srcMatches.length > 1) {
                srcUrl = srcMatches[1]
            } else {
                // get inner script
                var txt = script1[0].match(/<script[^>]*>([\s\S]*?)<\/script>/i);
                if (txt && txt.length > 1) {
                    srcText = txt[1]
                }
            }
        }

        if (srcUrl) {
            if (alreadyLoaded.indexOf(srcUrl) < 0) {
                const script = document.createElement("script");
                script.src = srcUrl;
                script.async = true;
                script.onload = () => loadText(text);
                document.body.appendChild(script);

                alreadyLoaded.push(srcUrl);
            }
        } else if (srcText) {
            if (alreadyLoaded.indexOf(srcText) < 0) {
                const script = document.createElement("script");
                script.innerHTML = srcText;
                script.async = true;
                script.onload = () => loadText(text);
                document.body.appendChild(script);

                alreadyLoaded.push(srcText);
            }
        }
    }

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'}
        ]);

        cacheFetchText(import.meta.env.VITE_HTML_EXTERNAL_FOOTER_URL, {
            method: 'GET'
        }, null).then(text => {
            // do substitutions of the footer template
            text = text.replace(/::loginURL::/g, "\" disabled=\"disabled");
            text = text.replace(/::logoutURL::/g, "\" disabled=\"disabled");
            if (currentUser?.isAdmin()) {
                text = text.replace(/::loginStatus::/g, "signedIn");
            } else {
                text = text.replace(/::loginStatus::/g, "");
            }

            var noScriptText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
            setExternalFooterHtml(noScriptText);

            loadText(text)
        });

        // fetch(import.meta.env.VITE_EXTERNAL_HEADER_URL, {
        //     method: 'GET'
        // }).then(response => response.text()).then(text => {
        //     setExternalFooterHtml(text);
        // });
    }, []);

    const currentUser = useContext(UserContext) as ListsUser;
    if (currentUser && !userProperties) {
        getUserProperties();
    }

    function clickHandler(e: any) {
        if (e.target.classList.contains('loginBtn')) {
            if (login) {
                login();
            }
        } else if (e.target.classList.contains('logoutBtn')) {
            if (logout) {
                logout();
            }
        }
        e.preventDefault()
    }

    const changeHandler = (event) => {
        setSelectedFile(event.target.files[0]);
        setIsFilePicked(true);
    };

    const handleSubmission = () => {
        const formData = new FormData();

        formData.append('file', selectedFile);

        fetch(
            import.meta.env.VITE_APP_BIE_URL + '/v1/sandbox/upload',
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                }
            }
        )
            .then((response) => response.json())
            .then((result) => {
                console.log('Success:', result);

                // do ingress
                fetch(
                    import.meta.env.VITE_APP_BIE_URL + '/v1/sandbox/ingress',
                    {
                        method: 'POST',
                        body: JSON.stringify(result),
                        headers: {
                            'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                            'Content-Type': 'application/json'
                        }
                    }
                )
                    .then((response) => response.json())
                    .then((result) => {
                        console.log('SuccessIngress:', result);
                    })
                    .catch((error) => {
                        console.error('ErrorIngress:', error);
                    });

            })
            .catch((error) => {
                console.error('Error:', error);
            });
    };

    return (
        <>
            <div className="container-fluid">
                {/*{!currentUser?.isAdmin() &&*/}
                {/*    <p>User {currentUser?.user()??.profile?.name} is not authorised to access these tools.</p>*/}
                {/*}*/}
                {/*{currentUser?.isAdmin() &&*/}
                <>
                    <h3>Admin Pages</h3>
                    <table className="table table-bordered">
                        <thead>
                        <tr>
                            <th className="col-2"></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td>
                                <Link to="/atlas-admin">Atlas Admin</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Update search index with names-index and other data.</li>
                                    <li>View Admin Logs</li>
                                    <li>Edit preferred images, hidden images and wikipedia URL for a TAXON.</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Link to="/data-quality-admin">Data Quality Admin</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Edit data quality profiles</li>
                                </ul>
                            </td>
                        </tr>
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/entity-admin">Entity Admin (collectory)</Link>*/}
                        {/*    </td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Edit entities</li>*/}
                        {/*            <li>IPT management</li>*/}
                        {/*            <li>GBIF sync</li>*/}
                        {/*            <li>View Logs</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Sensitive Admin</Link>*/}
                        {/*    </td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Rebuild sensitive list</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        Admin Search, List and Show*/}
                        {/*    </td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li><Link to="/todo">downloads (doi)</Link></li>*/}
                        {/*            <li><Link to="/todo">users (userdetails)</Link></li>*/}
                        {/*            <li><Link to="/todo">alerts (alerts)</Link></li>*/}
                        {/*            <li><Link to="/todo">users (users)</Link></li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Data quality profiles Admin</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Edit data quality profiles</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Species Lists</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Search, list and show lists</li>*/}
                        {/*            <li>Manage all lists</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Spatial Admin</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Manage layers</li>*/}
                        {/*            <li>Manage task queue</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        </tbody>
                    </table>

                    <h3>User Pages</h3>
                    <table className="table table-bordered">
                        <thead>
                        <tr>
                            <th className="col-2"></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td>
                                <Link to="/atlas-index">Atlas Index</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Search, List, Facet and Show</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Link to="/dashboard">Dashboard</Link></td>
                            <td>
                                <ul>
                                    <li>View the default dashboard</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Link to="/vocab">Vocabulary</Link></td>
                            <td>
                                <ul>
                                    <li>View and search the vocabulary</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>Occurrences</td>
                            <td>
                                <ul>
                                    <li><Link to="/occurrence-search">Search Page</Link></li>
                                    <li><Link to="/occurrence-list?q=forg&qualityProfile=ALA">Search Result Page</Link>
                                    </li>
                                    <li><Link to="/occurrence?id=5a3f4768-0c28-4c56-9814-1e32a3f35aec">Occurrence
                                        page</Link></li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>Species</td>
                            <td>
                                <ul>
                                    <li><Link to="/species?id=https://biodiversity.org.au/afd/taxa/2a4e373b-913a-4e2a-a53f-74828f6dae7e">Species Page</Link></li>
                                </ul>
                            </td>
                        </tr>
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Explore My Area</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Explore my area, for species</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Regions</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Explore a list of chosen areas, for species</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Spatial</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Spatial analysis</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        <Link to="/todo">Species Lists</Link></td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li>Search, list and show lists</li>*/}
                        {/*            <li>Manage user lists</li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*            <li><Link to="/todo">occurrences (biocache)</Link></li>*/}
                        {/*            <li><Link to="/todo">species (namematching)</Link></li>*/}
                        {/*            <li><Link to="/todo">media (images)</Link></li>*/}
                        {/*            <li><Link to="/todo">species lists (species lists)</Link></li>*/}
                        {/*            <li><Link to="/todo">spatial objects (spatial)</Link></li>*/}
                        {/*            <li><Link to="/todo">downloads (doi)</Link></li>*/}
                        {/*            <li><Link to="/todo">alerts (alerts)</Link></li>*/}
                        {/*            <li><Link to="/todo">users (userdetails)</Link></li>*/}
                        {/*            <li><Link to="/todo">events (events)</Link></li>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        Upload*/}
                        {/*    </td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li><Link to="/todo">Species List</Link></li>*/}
                        {/*            <li><Link to="/todo">Spatial area</Link></li>*/}
                        {/*            <li><Link to="/todo">Occurrence DwCA (publishing)</Link></li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <td>*/}
                        {/*        Generate*/}
                        {/*    </td>*/}
                        {/*    <td>*/}
                        {/*        <ul>*/}
                        {/*            <li><Link to="/todo">Fieldguide</Link></li>*/}
                        {/*            <li><Link to="/todo">Species List</Link></li>*/}
                        {/*            <li><Link to="/todo">Download</Link></li>*/}
                        {/*            <li><Link to="/todo">Spatial analysis</Link></li>*/}
                        {/*        </ul>*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
                        <tr>
                            <td><Link to="/api">API</Link></td>
                            <td>
                                <ul>
                                    <li>API documentation</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td><Link to="/map">Map</Link></td>
                            <td>
                                <ul>
                                    <li>Maps, large and small</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td><Link to="/chart">Charts</Link></td>
                            <td>
                                <ul>
                                    <li>Charts playground</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>User properties</td>
                            <td>
                                <pre><div>'get' result: {userProperties}</div></pre>
                                <br/>
                                <input type="text" value={userKey} onChange={(e) => setUserKey(e.target.value)}/>
                                <input type="text" value={userValue}
                                       onChange={(e) => setUserValue(e.target.value)}/>
                                <button onClick={() => {
                                    if (!userKey || !userValue) {
                                        return;
                                    }

                                    const data = new URLSearchParams();
                                    data.append("name", userKey);
                                    data.append("value", userValue);
                                    data.append("alaId", currentUser?.userId());

                                    fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property", {
                                        method: 'POST',
                                        body: data,
                                        headers: {
                                            'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                                        }
                                    }).then(response => {
                                        console.log(response);
                                    });
                                }}>Save
                                </button>
                                <button onClick={() => getUserProperties()}>Get
                                </button>


                            </td>
                        </tr>
                        <tr>
                            <td>
                                <input type="file" name="file" onChange={changeHandler}/>
                                {isFilePicked ? (
                                    <div>
                                        <p>Filename: {selectedFile.name}</p>
                                        <p>Filetype: {selectedFile.type}</p>
                                        <p>Size in bytes: {selectedFile.size}</p>
                                        <p>
                                            lastModifiedDate:{' '}
                                            {selectedFile.lastModifiedDate.toLocaleDateString()}
                                        </p>
                                    </div>
                                ) : (
                                    <p>Select a file to show details</p>
                                )}
                                <div>
                                    <button onClick={handleSubmission}>Submit</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Some tests
                            </td>
                            <td>
                                <link rel="stylesheet" type="text/css"
                                      href={import.meta.env.VITE_CSS_EXTERNAL_TEST}/>
                                <div className="test-external-css">Red if external css import is working. The login
                                    and logout buttons below should also work.
                                </div>

                                {externalFooterHtml &&
                                    <div onClick={clickHandler}
                                         dangerouslySetInnerHTML={{__html: externalFooterHtml}}></div>
                                }
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </>
                {/*}*/}
            </div>
        </>
    );
}

export default Home;
