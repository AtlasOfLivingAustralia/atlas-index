import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser, TaskType} from "../api/sources/model.ts";
import {Tab, Tabs} from "react-bootstrap";
import "../css/atlasAdmin.css"

const defaultTaskFilter = '(N entries for each type)';

function AtlasAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const currentUser = useContext(UserContext) as ListsUser;
    const [queueString, setQueueString] = useState('');
    const [showQueue, setShowQueue] = useState(false);
    const [logString, setLogString] = useState('');
    const [logFilter, setLogFilter] = useState('');
    const [logSize, setLogSize] = useState(1);
    const [taskTypes, setTaskTypes] = useState<string[] | []>([defaultTaskFilter]);
    const [taskString, setTaskString] = useState('');
    const [guid, setGuid] = useState('');
    const [guidSearched, setGuidSearched] = useState('');
    const [taxonString, setTaxonString] = useState('');
    const [tab, setTab] = useState('species');
    const [speciesTab, setSpeciesTab] = useState('json');
    const [taxonID, setTaxonID] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [heroDescription, setHeroDescription] = useState('');
    const [saveHeroDescriptionResponse, setSaveHeroDescriptionResponse] = useState('');
    const [descriptionJson, setDescriptionJson] = useState('');
    const [saveDescriptionJsonResponse, setSaveDescriptionJsonResponse] = useState('');
    const [preferredImage, setPreferredImage] = useState('');
    const [hiddenImage, setHiddenImage] = useState('');
    const [saveImageResponse, setSaveImageResponse] = useState('');
    const [speciesJsonFilter, setSpeciesJsonFilter] = useState('');
    const [filteredTaxonString, setFilteredTaxonString] = useState('');
    const [images, setImages] = useState<string []>([]);
    const [imageStart, setImageStart] = useState(0);
    const [imageViewMode, setImageViewMode] = useState('all');
    const [description, setDescription] = useState<{ [key: string]: string }>({})
    const [lastRun, setLastRun] = useState<{ [key: string]: string }>({})

    const imagePageSize = 100;

    const hiddenImageListID: string = import.meta.env.VITE_HIDDEN_IMAGES_LIST_ID;
    const preferredImageListID: string = import.meta.env.VITE_PREFERRED_IMAGES_LIST_ID;
    const heroDescriptionListID: string = import.meta.env.VITE_HERO_DESCRIPTION_LIST_ID;

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Search Index Admin', href: '/atlas-admin'},
        ]);
        if (currentUser && !currentUser?.isLoading()) {
            fetchLog();
        }
    }, [currentUser]);

    function fetchLog(requestedLogFilter? : string, requestedLogSize? : number) {
        var thisLogFilter = requestedLogFilter ? requestedLogFilter : logFilter;
        var type = thisLogFilter !== defaultTaskFilter && thisLogFilter ? "&type=" + thisLogFilter : "";
        var thisLogSize = requestedLogSize ? requestedLogSize : logSize;
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/info?pageSize=' + thisLogSize + type, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
            }
        }).then(response => {
            if (response.ok) {
                response.json().then(json => {
                    // iterate on rawLog and modify time to String
                    for (let key of Object.keys(json.tasks)) {
                        for (let log of json.tasks[key].log) {
                            log.modifiedDate = new Date(log.modified).toLocaleString() + "." + log.modified.toString().slice(-3)
                        }
                    }

                    setQueueString(JSON.stringify(json.queues, null, 2));

                    //let filteredLog: TaskType = json.tasks[logFilter];

                    // if (filteredLog !== undefined && defaultTaskFilter !== logFilter) {
                    //     setLogString(JSON.stringify(flattenLog(filteredLog), null, 2))
                    // } else {
                        setLogString(JSON.stringify(flattenLogAll(json.tasks), null, 2))
                    // }

                    let newDescription: { [key: string]: string } = {...description}
                    let newLastRun: { [key: string]: string } = {...lastRun}

                    // check for new task types, and update description
                    var newTypes: string[] = []
                    for (let task of Object.keys(json.tasks)) {
                        var exists = false
                        for (let key of taskTypes) {
                            if (key === task) {
                                exists = true;
                                break;
                            }
                        }
                        if (!exists) {
                            newTypes.push(task)
                        }

                        newDescription[task] = json.tasks[task].description + " (enabled:" + json.tasks[task].enabled + ")";
                        newLastRun[task] = json.tasks[task]?.log?.length ? json.tasks[task]?.log[0].modifiedDate : "never"
                    }

                    // update task descriptions
                    setDescription(newDescription)

                    // update task last run times
                    setLastRun(newLastRun)

                    // update task types
                    if (newTypes.length > 0) {
                        let sorted = [...taskTypes, ...newTypes].sort()
                        setTaskTypes(sorted)
                    }

                })
            }
        });
    }

    function flattenLogAll(tasks: { [key: string]: TaskType }) {
        let flatLog: string[] = [];

        // iterate on tasks and modify time to String
        for (let key of Object.keys(tasks)) {
            for (let log of tasks[key].log) {
                var date = new Date(log.modified);
                const formattedDate = date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0') + ' ' +
                    String(date.getHours()).padStart(2, '0') + ':' +
                    String(date.getMinutes()).padStart(2, '0') + ':' +
                    String(date.getSeconds()).padStart(2, '0') + '.' +
                    String(date.getMilliseconds()).padStart(3, '0');
                flatLog.push(formattedDate + " " + log.task + ": " + log.message);
            }
        }

        flatLog = flatLog.sort().reverse();

        return flatLog
    }

    function update(updateType: string) {
        setTaskString("Running " + updateType + " update...");
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/update?type=' + updateType, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
            }
        }).then(response => {
            response.json().then(json => {
                setTaskString(JSON.stringify(json, null, 2))
            })
        });
    }

    function searchGuid() {
        setGuidSearched(guid)
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/species', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([guid]),
        }).then(response => {
            response.json().then(json => {
                setTaxonString(JSON.stringify(json, null, 2))
                setImageStart(0);
                setImages([])
                if (json.length > 0) {
                    setTaxonID(json[0].guid)
                    setScientificName(json[0].scientificName)
                    json[0].image ? setPreferredImage(json[0].image) : setPreferredImage('')
                    json[0].hiddenImages_s ? setHiddenImage(json[0].hiddenImages_s) : setHiddenImage('')
                    json[0].heroDescription ? setHeroDescription(json[0].heroDescription) : setHeroDescription('')

                    getDescriptionsJson(json[0].guid);
                }
                setTimeout(() => filterSpeciesJson(speciesJsonFilter), 1);
            })
        });
    }

    function getDescriptionsJson(taxonID: string) {
        var lsidEncoded = encodeURIComponent(encodeURIComponent(taxonID))

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + "/" + lsidEncoded.substring(lsidEncoded.length - 2) + "/" + lsidEncoded + ".json")
            .then(response => response.json()).then(json => {
            setDescriptionJson(JSON.stringify(json, null, 2))
        }).catch(() => {
            // This will disable the 'loading' indicator in DescriptionView
            setDescriptionJson("")
        });
    }

    function saveImages() {
        // set preferred image, then hidden image
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                field: 'image',
                value: preferredImage
            })
        }).then(responsePrefer => {
            if (responsePrefer.ok) {
                fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taxonID: taxonID,
                        scientificName: scientificName,
                        field: 'hiddenImages_s',
                        value: hiddenImage
                    })
                }).then(responseHide => {
                    setSaveImageResponse(responsePrefer.status + ": " + responsePrefer.statusText + ", " + responseHide.status + ": " + responseHide.statusText);
                })
            } else {
                setSaveImageResponse(responsePrefer.status + ": " + responsePrefer.statusText)
            }
        });
    }

    function filterSpeciesJson(filterString: string) {
        setSpeciesJsonFilter(filterString)

        // filter each line of the taxonString
        if (filterString && taxonString) {
            let inputRows = taxonString.split('\n')
            let outputRows: string[] = []
            inputRows.forEach((line: string) => {
                let trimed = line.trim()
                if (line.indexOf(filterString) >= 0 || trimed.startsWith('[') || trimed.endsWith(']') || trimed.startsWith('{') || trimed.endsWith('}') || trimed.endsWith('],') || trimed.endsWith(': [') || trimed.endsWith(': {') || trimed.startsWith('},') || trimed.startsWith('],')) {
                    outputRows.push(line)
                }
            })
            setFilteredTaxonString(outputRows.join('\n'))
        }
    }

    function loadImages() {
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/search?fq=imageID:*&q=lsid:"' + taxonID + '"&fl=imageID&pageSize=' + imagePageSize + '&start=' + imageStart, {
            method: 'GET'
        }).then(response => {
            setImageStart(imageStart + imagePageSize);
            response.json().then(json => {
                let list: string[] = [];
                for (let record of json.occurrences) {
                    list.push(record.image);
                }
                setImages([...images, ...list]);
            })
        })
    }

    // priority 0 is default, -1 is hidden, 1-5 are priority
    function getImagePriority(imageID: string): number {
        let idxPriority = preferredImage.split(',').indexOf(imageID)
        let idxHidden = hiddenImage.indexOf(imageID)
        if (idxPriority >= 0) {
            return idxPriority + 1
        } else if (idxHidden >= 0) {
            return -1
        }
        return 0;
    }

    function buildImageCard(imageID: string, idx: number) {
        let priority: number = getImagePriority(imageID);

        return <div key={idx}
                    className={"card m-1 " + (priority > 0 ? "border-success border-5" : (priority < 0 ? "border-danger border-5" : "border-black"))}>
            <a className="card-img-top" target="_blank"
               href={import.meta.env.VITE_APP_IMAGE_LINK_URL + imageID}>
                <img src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + imageID}></img>
            </a>
            <div className="card-body d-flex flex-column">
                <select className="custom-select mt-auto" value={priority}
                        onChange={e => changeImage(parseInt(e.target.value), imageID)}>
                    <option value="0">Default</option>
                    <option value="-1">Hide Image</option>
                    <option value="1">Image Priority 1</option>
                    <option value="2">Image Priority 2</option>
                    <option value="3">Image Priority 3</option>
                    <option value="4">Image Priority 4</option>
                    <option value="5">Image Priority 5</option>
                </select>
            </div>
        </div>
    }

    function changeImage(priority: number, imageID: string) {
        let currentPriority = getImagePriority(imageID);
        let hiddenIdx = hiddenImage.indexOf(imageID)

        if (priority < 0 && currentPriority >= 0) {
            // add to hidden
            setHiddenImage(hiddenImage ? hiddenImage + "," + imageID : imageID)
        } else if (priority >= 0 && hiddenIdx >= 0) {
            // remove from hidden
            setHiddenImage(hiddenImage.split(",").filter((value) => value !== imageID).join(","))
        }

        if (priority !== currentPriority) {
            // rebuild preferred list and insert or remove it
            let list: string[] = []
            preferredImage.split(",").forEach((value) => {
                if (list.length < 5) {
                    if (list.length == priority - 1) {
                        list.push(imageID)
                    }
                }
                if (list.length < 5 && value !== imageID) {
                    list.push(value)
                }
            })

            if (priority > 0 && list.indexOf(imageID) < 0) {
                list.push(imageID)
            }

            setPreferredImage(list.join(","))
        }
    }

    function saveHeroDescription() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taxonID: taxonID,
                field: 'heroDescription',
                value: heroDescription

            })
        }).then(responsePrefer => {
            setSaveHeroDescriptionResponse(JSON.stringify(responsePrefer))
        });
    }

    function saveDescriptionJson() {
        // validate that it is JSON
        try {
            JSON.parse(descriptionJson)
        } catch (e) {
            alert("Invalid JSON")
            setSaveDescriptionJsonResponse("Invalid JSON")
            return
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taxonID: taxonID,
                field: 'descriptions',
                value: descriptionJson
            })
        }).then(responsePrefer => {
            setSaveDescriptionJsonResponse(JSON.stringify(responsePrefer))
        });
    }

    function openLog(type: string) {
        setLogSize(100);
        setLogFilter(type);
        fetchLog(type, 100);
        setTab("log");
        window.scrollTo(0, 0);
    }

    return (
        <div className="container-fluid">
            <div className={"mt-5"}/>
            {!currentUser?.isAdmin() &&
                <p>User {currentUser?.user()?.profile?.name} is not authorised to access these tools.</p>
            }
            {currentUser?.isAdmin() &&
                <>
                    <Tabs
                        id="admin-tabs"
                        activeKey={tab}
                        onSelect={(k) => setTab("" + k)}
                        className=""
                    >
                        <Tab eventKey="tasks" title="Background tasks">
                            <pre className="alert alert-secondary" style={{height: "100px"}}><small>{taskString}</small></pre>
                            <table className="table table-sm table-bordered">
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>View log</th>
                                        <th>Last Run</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('ALL')}>Update ALL
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('ALL')}>log</a>
                                    </td>
                                    <td>{lastRun['ALL']}</td>
                                    <td>
                                        <p>{description['ALL']}</p>
                                        <ul>
                                            <li>When the ES index is empty this will import the local DWCA names index, then run all other enabled tasks.</li>
                                            <li>When the index is not empty this will run all enabled tasks except for the local DWCA names index import.</li>
                                            <li>This task is scheduled to run regularly.</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('BIOCACHE')}>
                                            Update BIOCACHE
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('BIOCACHE')}>log</a>
                                    </td>
                                    <td>{lastRun['BIOCACHE']}</td>
                                    <td>{description['BIOCACHE']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('TAXON_DESCRIPTION')}>
                                            Update TAXON DESCRIPTIONS
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('TAXON_DESCRIPTION')}>log</a>
                                    </td>
                                    <td>{lastRun['TAXON_DESCRIPTION']}</td>
                                    <td>{description['TAXON_DESCRIPTION']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('AREA')}>
                                            Update AREA
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('AREA')}>log</a>
                                    </td>
                                    <td>{lastRun['AREA']}</td>
                                    <td>{description['AREA']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('BIOCOLLECT')}>
                                            Update BIOCOLLECT
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('BIOCOLLECT')}>log</a>
                                    </td>
                                    <td>{lastRun['BIOCOLLECT']}</td>
                                    <td>{description['BIOCOLLECT']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('COLLECTIONS')}>
                                            Update COLLECTIONS
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('COLLECTIONS')}>log</a>
                                    </td>
                                    <td>{lastRun['COLLECTIONS']}</td>
                                    <td>{description['COLLECTIONS']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('LAYER')}>
                                            Update LAYER
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('LAYER')}>log</a>
                                    </td>
                                    <td>{lastRun['LAYER']}</td>
                                    <td>{description['LAYER']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('WORDPRESS')}>
                                            Update WORDPRESS
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('WORDPRESS')}>log</a>
                                    </td>
                                    <td>{lastRun['WORDPRESS']}</td>
                                    <td>{description['WORDPRESS']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('KNOWLEDGEBASE')}>
                                            Update KNOWLEDGEBASE
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('KNOWLEDGEBASE')}>log</a>
                                    </td>
                                    <td>{lastRun['KNOWLEDGEBASE']}</td>
                                    <td>{description['KNOWLEDGEBASE']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('LISTS')}>
                                            Update LISTS
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('LISTS')}>log</a>
                                    </td>
                                    <td>{lastRun['LISTS']}</td>
                                    <td>{description['LISTS']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('DIGIVOL')}>
                                            Update DIGIVOL
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('DIGIVOL')}>log</a>
                                    </td>
                                    <td>{lastRun['DIGIVOL']}</td>
                                    <td>{description['DIGIVOL']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('SITEMAP')}>
                                            Update SITEMAP
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('SITEMAP')}>log</a>
                                    </td>
                                    <td>{lastRun['SITEMAP']}</td>
                                    <td>{description['SITEMAP']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('DASHBOARD')}>
                                            Update DASHBOARD
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('DASHBOARD')}>log</a>
                                    </td>
                                    <td>{lastRun['DASHBOARD']}</td>
                                    <td>{description['DASHBOARD']}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <button className="btn border-black task-button" onClick={() => update('CACHE_RESET')}>
                                            Reset caches
                                        </button>
                                    </td>
                                    <td>
                                        <a className="d-flex justify-content-center" onClick={() => openLog('CACHE_RESET')}>log</a>
                                    </td>
                                    <td>{lastRun['CACHE_RESET']}</td>
                                    <td>{description['CACHE_RESET']}</td>
                                </tr>
                                </tbody>
                            </table>
                        </Tab>
                        <Tab eventKey="log" title="Log">
                            <div className="d-flex w-100 align-items-center alert alert-secondary">
                                <select className="custom-select w-25" id="filter"
                                        onChange={e => {setLogFilter(e.target.value); fetchLog(e.target.value);}}>
                                    {taskTypes.map((type, index) => <option key={index} selected={type == logFilter}>{type}</option>)};
                                </select>
                                <label htmlFor="logSize" className="ms-5 me-1">log size</label>
                                <input id="logSize" value={logSize} onChange={e => {
                                    setLogSize(parseInt(e.target.value));
                                }}/>

                                <input type="checkbox" className="ms-5 me-2"
                                       onChange={e => setShowQueue(e.target.checked)}/>Show Threads & Queues

                                <button className="btn border-black ms-5 me-5" onClick={() => fetchLog()}>Refresh
                                    Log</button>
                            </div>

                            {showQueue &&
                                <>
                                    <pre><small>{queueString}</small></pre>
                                    <hr/>
                                </>

                            }
                            <pre><small>{logString}</small></pre>
                        </Tab>
                        <Tab eventKey="species" title="Edit indexed taxon">
                            <div className="d-flex w-100 align-items-center alert alert-secondary">
                                <label>Search taxon ID, linkIdentifier, scientificName, nameComplete or commonName</label>
                                <input id="guid" className="w-50 ms-2" value={guid} onChange={e => {
                                    setGuid(e.target.value);
                                }}/>
                                <button className="btn border-black ms-2"
                                        onClick={() => searchGuid()}>Search
                                </button>
                            </div>
                            { taxonString &&
                                <div className="border border-2 border-black p-3">
                                    <Tabs
                                        id="species-tabs"
                                        activeKey={speciesTab}
                                        onSelect={(k) => setSpeciesTab("" + k)}
                                        className=""
                                    >
                                        <Tab eventKey="json" title="Raw JSON">
                                            <table className="table table-sm">
                                                <thead>
                                                <tr>
                                                    <th className="col-2"></th>
                                                    <th className="col-10"></th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                <tr>
                                                    <td>
                                                        TaxonID
                                                    </td>
                                                    <td>
                                                        <pre>{taxonID} (searched for "{guidSearched}")</pre>
                                                    </td>
                                                </tr>
                                                </tbody>
                                            </table>
                                            <br/>
                                            <input type="text" placeholder="filter JSON" className="w-100"
                                                   value={speciesJsonFilter}
                                                   onChange={e => filterSpeciesJson(e.target.value)}/>
                                            <pre><small>{filteredTaxonString ?
                                                <>
                                                    {filteredTaxonString}
                                                </> :
                                                <>
                                                    {taxonString}
                                                </>
                                            }</small></pre>
                                        </Tab>

                                        <Tab eventKey="images" title="Image preferences">
                                            <table className="table table-sm">
                                                <thead>
                                                <tr>
                                                    <th className="col-2"></th>
                                                    <th className="col-10"></th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                <tr>
                                                    <td>
                                                        TaxonID
                                                    </td>
                                                    <td>
                                                        <pre>{taxonID} (searched for "{guidSearched}")</pre>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td><label htmlFor="preferredImage" className="ms-auto me-1 mb-4">Prefered
                                                        imageIDs (comma separated, no whitespace)</label>
                                                        <a target="_blank"
                                                           href={import.meta.env.VITE_APP_LIST_URL + preferredImageListID}>Open preferred
                                                            image species list</a></td>
                                                    <td>
                                                    <textarea className="form-control" id="preferredImage"
                                                              value={preferredImage}
                                                              rows={3}
                                                              onChange={e => {
                                                                  setPreferredImage(e.target.value);
                                                              }}></textarea>
                                                        <button className="btn border-black ms-auto me-5"
                                                                onClick={() => {
                                                                    setSaveImageResponse("...");
                                                                    saveImages()
                                                                }}>Save Changes
                                                        </button>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td><label htmlFor="hiddenImage" className="ms-auto me-1 mb-4">Hidden
                                                        imageIDs (comma separated, no whitespace)</label>
                                                        <a target="_blank"
                                                           href={import.meta.env.VITE_APP_LIST_URL + hiddenImageListID}>Open hidden
                                                        image species list</a></td>
                                                    <td>
                                                    <textarea className="form-control" id="hiddenImage"
                                                              value={hiddenImage}
                                                              rows={3}
                                                              onChange={e => {
                                                                  setHiddenImage(e.target.value);
                                                              }}></textarea>
                                                        <button className="btn border-black ms-auto me-5"
                                                                onClick={() => {
                                                                    setSaveImageResponse("...");
                                                                    saveImages()
                                                                }}>Save Changes
                                                        </button>
                                                    </td>
                                                </tr>

                                                {saveImageResponse &&
                                                    <tr>
                                                        <td>
                                                            Response code
                                                        </td>
                                                        <td>
                                                            <pre>{saveImageResponse}</pre>
                                                        </td>
                                                    </tr>
                                                }

                                                <tr>
                                                    <td>
                                                        Browse Images
                                                    </td>
                                                    <td>
                                                        <select className="mb-4" value={imageViewMode}
                                                                onChange={e => setImageViewMode(e.target.value)}>
                                                            <option value="all">All Images</option>
                                                            <option value="preferred">Preferred Images</option>
                                                            <option value="hidden">Hidden Images</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                                </tbody>
                                            </table>
                                            <div className="d-flex flex-wrap">
                                                {imageViewMode === 'preferred' && preferredImage && preferredImage.split(",").map((imageID, idx) => {
                                                    return buildImageCard(imageID, idx);
                                                })}
                                                {imageViewMode === 'hidden' && hiddenImage && hiddenImage.split(",").map((imageID, idx) => {
                                                    return buildImageCard(imageID, idx);
                                                })}
                                                {imageViewMode === 'all' && images.map((imageID, idx) => {
                                                    return buildImageCard(imageID, idx);
                                                })}
                                            </div>
                                            {imageViewMode === 'all' &&
                                                <button className="btn border-black"
                                                        onClick={() => loadImages()}>Load More Images
                                                </button>
                                            }
                                        </Tab>

                                        <Tab eventKey="descriptions" title="Descriptions">
                                            <table className="table table-sm">
                                                <thead>
                                                <tr>
                                                    <th className="col-4"></th>
                                                    <th className="col-8"></th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                <tr>
                                                    <td>
                                                        TaxonID
                                                    </td>
                                                    <td>
                                                        <pre>{taxonID} (searched for "{guidSearched}")</pre>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Hero description (HTML)
                                                        <br/>
                                                        <br/>
                                                        <a target="_blank"
                                                           href={import.meta.env.VITE_APP_LIST_URL + heroDescriptionListID}>Open hero description list
                                                        </a>
                                                </td>
                                                    <td>
                                                        <textarea id="heroDescription" className="w-100" rows={5} value={heroDescription}
                                                               onChange={e => {
                                                                   setHeroDescription(e.target.value);
                                                               }}/>
                                                        <button className="btn border-black"
                                                                onClick={() => {
                                                                    setSaveHeroDescriptionResponse("...");
                                                                    saveHeroDescription()
                                                                }}>Save Changes
                                                        </button>
                                                    </td>
                                                </tr>

                                                {saveHeroDescriptionResponse &&
                                                    <tr>
                                                        <td>
                                                            Response code (Hero Description)
                                                        </td>
                                                        <td>
                                                            <pre>{saveHeroDescriptionResponse}</pre>
                                                        </td>
                                                    </tr>
                                                }

                                                <tr>
                                                    <td>Descriptions (JSON).
                                                    <ul>
                                                        <li>Edit the HTML category values.</li>
                                                        <li>Edit fields. Excludes "name", "url" and "attribution" values. Excludes changes to keys. To change these, refer to the taxon-description tool.</li>
                                                        <li>Order of items cannot be changed.</li>
                                                        <li>Items cannot be deleted.</li>
                                                        <li>Items cannot be added.</li>
                                                    </ul>
                                                    </td>
                                                    <td>
                                                        <textarea id="descriptionJson" className="w-100" rows={20} value={descriptionJson}
                                                                  onChange={e => {
                                                                      setDescriptionJson(e.target.value);
                                                                  }}/>
                                                        <button className="btn border-black"
                                                                onClick={() => {
                                                                    setSaveDescriptionJsonResponse("...");
                                                                    saveDescriptionJson()
                                                                }}>Save Changes
                                                        </button>
                                                    </td>
                                                </tr>

                                                {saveDescriptionJsonResponse &&
                                                    <tr>
                                                        <td>
                                                            Response code (Description JSON)
                                                        </td>
                                                        <td>
                                                            <pre>{saveDescriptionJsonResponse}</pre>
                                                        </td>
                                                    </tr>
                                                }
                                                </tbody>
                                            </table>
                                        </Tab>
                                    </Tabs>
                                </div>
                            }
                        </Tab>
                    </Tabs>
                </>
            }
        </div>
    );
}

export default AtlasAdmin;
