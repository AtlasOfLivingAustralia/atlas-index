import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import {Link} from "react-router-dom";

function Home({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    const [userProperties, setUserProperties] = useState<string | null>();
    const [userKey, setUserKey] = useState<string>();
    const [userValue, setUserValue] = useState<string>();

    const [selectedFile, setSelectedFile] = useState<File>();
    const [isFilePicked, setIsFilePicked] = useState(false);

    const [sandboxResponse, setSandboxResponse] = useState({});
    const [sandboxUploadResponse, setSandboxUploadResponse] = useState({});
    const [sandboxDatasetName, setSandboxDatasetName] = useState('my sandbox upload');

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

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'}
        ]);
    }, []);

    const currentUser = useContext(UserContext) as ListsUser;
    if (currentUser && !userProperties) {
        getUserProperties();
        console.log("another admin test: " + currentUser.isAdmin());
    }

    const changeHandler = (event: any) => {
        setSelectedFile(event.target.files[0]);
        setIsFilePicked(true);
    };

    const handleSubmission = () => {
        if (!selectedFile) {
            alert('Please choose a file to upload');
            return;
        }

        const formData = new FormData();

        formData.append('file', selectedFile);
        formData.append('datasetName', sandboxDatasetName);

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
                setSandboxUploadResponse(result)

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
                        setSandboxResponse(result)
                        setTimeout(function () {
                            sandboxStatus(result.id)
                        }, 1000);
                    })
                    .catch((error) => {
                        console.error('ErrorIngress:', error);
                        setSandboxResponse({"error": error})
                    });

            })
            .catch((error) => {
                console.error('Error:', error);
            });
    };

    function sandboxStatus(id: string) {
        console.log("sandboxStatus")
        // do ingress
        fetch(
            import.meta.env.VITE_APP_BIE_URL + '/v1/sandbox/ingress?id=' + id,
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                    'Content-Type': 'application/json'
                }
            }
        )
            .then((response) => response.json())
            .then((result) => {
                console.log('SuccessIngressStatus:', result);
                setSandboxResponse(result)

                if (result.statusCode === "QUEUED" || result.statusCode === "RUNNING") {
                    setTimeout(function () {
                        sandboxStatus(result.id)
                    }, 1000);
                    return;
                }
            })
            .catch((error) => {
                console.error('ErrorIngressStatus:', error);
                setSandboxResponse({"error-status": error})
            });
    }

    return (
        <>
            <div className="container-fluid">
                <>
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
                                <Link to="/atlas-admin">Search Index</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Update search index with names-index and other data sources.</li>
                                    <li>View search index's admin logs.</li>
                                    <li>Edit taxon records for preferred images, hidden images and descriptions.</li>
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
                        <tr>
                            <td>Occurrences (mockup)</td>
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
                            <td>biocache-service, user properties</td>
                            <td>
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
                                <br/>
                                <pre><div>'get' result: {userProperties}</div></pre>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                sandbox replacement service
                            </td>
                            <td>
                                <input type="file" name="file" onChange={changeHandler}/>
                                {isFilePicked ? (
                                    <div>
                                        <p>Filename: {selectedFile?.name}</p>
                                        <p>Filetype: {selectedFile?.type}</p>
                                        <p>Size in bytes: {selectedFile?.size}</p>
                                        <p>
                                            lastModifiedDate:{' '}
                                            {selectedFile ? new Date(selectedFile.lastModified).toLocaleDateString() : ''}
                                        </p>
                                    </div>
                                ) : (
                                    <p>Select a csv file to upload to the sandbox service</p>
                                )}
                                <div>
                                    <input type="text" value={sandboxDatasetName}
                                           onChange={(e) => setSandboxDatasetName(e.target.value)}/>
                                    <button onClick={handleSubmission}>Submit</button>
                                </div>
                                <div>
                                    sandboxUpload response: {JSON.stringify(sandboxUploadResponse, null, 2)}
                                </div>
                                <div>
                                    sandboxStatus response: {JSON.stringify(sandboxResponse, null, 2)}
                                </div>
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
