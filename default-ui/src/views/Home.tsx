import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import {Link} from "react-router-dom";

function Home({setBreadcrumbs, signinRedirect, logout}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    signinRedirect?: () => Promise<void>,
    logout?: () => void
}) {
    const [externalFooterHtml, setExternalFooterHtml] = useState('');
    // const [externalHeaderHtml, setExternalHeaderHtml] = useState('');

    const alreadyLoaded:string[] = [];

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
            }
        } else if (srcText) {
            if (alreadyLoaded.indexOf(srcText) < 0) {
                const script = document.createElement("script");
                script.innerHTML = srcText;
                script.async = true;
                script.onload = () => loadText(text);
                document.body.appendChild(script);
            }
        }
    }

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'}
        ]);

        fetch(import.meta.env.VITE_HTML_EXTERNAL_FOOTER_URL, {
            method: 'GET'
        }).then(response => response.text()).then(text => {
            // do substitutions of the footer template
            text = text.replace(/::loginURL::/g, "\" disabled=\"disabled");
            text = text.replace(/::logoutURL::/g, "\" disabled=\"disabled");
            if (currentUser?.isAdmin) {
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

    function clickHandler(e : any) {
        if (e.target.classList.contains('loginBtn')) {
            if (signinRedirect) {
                signinRedirect();
            }
        } else if (e.target.classList.contains('logoutBtn')) {
            if (logout) {
                logout();
            }
        }
        e.preventDefault()
    }

    return (
        <>
            <div className="container-fluid">
                {/*{!currentUser?.isAdmin &&*/}
                {/*    <p>User {currentUser?.user?.profile?.name} is not authorised to access these tools.</p>*/}
                {/*}*/}
                {/*{currentUser?.isAdmin &&*/}
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
