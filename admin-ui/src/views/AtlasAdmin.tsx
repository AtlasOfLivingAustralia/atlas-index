import {useEffect, useState} from 'react';
import {TaskType, Tasks} from '../api/sources/model.ts';
import {Tab, Tabs} from 'react-bootstrap';
import '../css/atlasAdmin.css';
import {useAuth} from 'react-oidc-context';
import Menu from '../components/menu.tsx';
import './atlasadmin.css';
import {Breadcrumb} from '@ala/common-ui';

const defaultTaskFilter = '(N entries for each type)';

function AtlasAdmin({setBreadcrumbs,}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [queueString, setQueueString] = useState('');
    const [showQueue, setShowQueue] = useState(false);
    const [logString, setLogString] = useState('');
    const [logFilter, setLogFilter] = useState('');
    const [logSize, setLogSize] = useState(1);
    const [taskString, setTaskString] = useState('');
    const [guid, setGuid] = useState('');
    const [guidSearched, setGuidSearched] = useState('');
    const [taxonString, setTaxonString] = useState('');
    const [tab, setTab] = useState('species');
    const [speciesTab, setSpeciesTab] = useState('json');
    const [taxonID, setTaxonID] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [heroDescription, setHeroDescription] = useState('');
    const [saveHeroDescriptionResponse, setSaveHeroDescriptionResponse] =
        useState('');
    const [descriptionJson, setDescriptionJson] = useState('');
    const [saveDescriptionJsonResponse, setSaveDescriptionJsonResponse] =
        useState('');
    const [preferredImage, setPreferredImage] = useState('');
    const [hiddenImage, setHiddenImage] = useState('');
    const [saveImageResponse, setSaveImageResponse] = useState('');
    const [speciesJsonFilter, setSpeciesJsonFilter] = useState('');
    const [filteredTaxonString, setFilteredTaxonString] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [imageStart, setImageStart] = useState(0);
    const [imageViewMode, setImageViewMode] = useState('all');
    const [tasks, setTasks] = useState<Tasks>({
        "ALL": {
            instructions: <ul>
                <li>
                    When the ES index is
                    empty this will import
                    the local DWCA names
                    index, then run all
                    other enabled tasks.
                </li>
                <li>
                    When the index is not
                    empty this will run all
                    enabled tasks except for
                    the local DWCA names
                    index import.
                </li>
                <li>
                    This task is scheduled
                    to run regularly.
                </li>
            </ul>
        }
    });

    const auth = useAuth();

    const imagePageSize = 100;

    const hiddenImageListID: string = import.meta.env
        .VITE_HIDDEN_IMAGES_LIST_ID;
    const preferredImageListID: string = import.meta.env
        .VITE_PREFERRED_IMAGES_LIST_ID;
    const heroDescriptionListID: string = import.meta.env
        .VITE_HERO_DESCRIPTION_LIST_ID;

    const isAdmin =
        auth.isAuthenticated &&
        Array.isArray(auth.user?.profile?.['cognito:groups']) &&
        auth.user.profile['cognito:groups'].includes('admin');
    console.log(
        'AtlasAdmin isAdmin',
        isAdmin,
        auth.user?.profile?.['cognito:groups']
    );

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Search Index', href: '/atlas-admin'},
        ]);
        if (isAdmin) {
            fetchLog();
        }
    }, [auth]);

    function fetchLog(requestedLogFilter?: string, requestedLogSize?: number) {
        var thisLogFilter = requestedLogFilter ? requestedLogFilter : logFilter;
        var type =
            thisLogFilter !== defaultTaskFilter && thisLogFilter
                ? '&type=' + thisLogFilter
                : '';
        var thisLogSize = requestedLogSize ? requestedLogSize : logSize;
        fetch(
            import.meta.env.VITE_APP_BIE_URL +
            '/v2/admin/log?pageSize=' +
            thisLogSize +
            type,
            {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + auth.user?.access_token,
                },
            }
        ).then((response) => {
            if (response.ok) {
                response.json().then((json) => {
                    // iterate on rawLog and modify time to String
                    for (let key of Object.keys(json.tasks)) {
                        for (let log of json.tasks[key].log) {
                            log.modifiedDate =
                                new Date(log.modified).toLocaleString() +
                                '.' +
                                log.modified.toString().slice(-3);
                        }
                    }

                    setQueueString(JSON.stringify(json.queues, null, 2));

                    setLogString(
                        JSON.stringify(flattenLogAll(json.tasks), null, 2)
                    );

                    // check for new task types, and update description
                    var newTasks = {...tasks};
                    for (let task of Object.keys(json.tasks)) {
                        if (!newTasks[task]) {
                            newTasks[task] = {}
                        }
                        newTasks[task].description = json.tasks[task].description +
                            ' (enabled:' + json.tasks[task].enabled + ')';
                        newTasks[task].lastRun = json.tasks[task]?.log?.length ? json.tasks[task]?.log[0].modifiedDate : 'never';
                    }
                    setTasks(newTasks);
                });
            }
        });
    }

    function flattenLogAll(tasks: { [key: string]: TaskType }) {
        let flatLog: string[] = [];

        // iterate on tasks and modify time to String
        for (let key of Object.keys(tasks)) {
            for (let log of tasks[key].log) {
                var date = new Date(log.modified);
                const formattedDate =
                    date.getFullYear() +
                    '-' +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    '-' +
                    String(date.getDate()).padStart(2, '0') +
                    ' ' +
                    String(date.getHours()).padStart(2, '0') +
                    ':' +
                    String(date.getMinutes()).padStart(2, '0') +
                    ':' +
                    String(date.getSeconds()).padStart(2, '0') +
                    '.' +
                    String(date.getMilliseconds()).padStart(3, '0');
                flatLog.push(
                    formattedDate + ' ' + log.task + ': ' + log.message
                );
            }
        }

        flatLog = flatLog.sort().reverse();

        return flatLog;
    }

    function update(updateType: string) {
        setTaskString('Running ' + updateType + ' update...');
        fetch(
            import.meta.env.VITE_APP_BIE_URL +
            '/v2/admin/task?type=' +
            updateType,
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + auth.user?.access_token,
                },
            }
        ).then((response) => {
            response.json().then((json) => {
                setTaskString(JSON.stringify(json, null, 2));
            });
        });
    }

    function searchGuid() {
        setGuidSearched(guid);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/species', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([guid]),
        }).then((response) => {
            response.json().then((json) => {
                setTaxonString(JSON.stringify(json, null, 2));
                setImageStart(0);
                setImages([]);
                if (json.length > 0) {
                    setTaxonID(json[0].guid);
                    setScientificName(json[0].scientificName);
                    json[0].image
                        ? setPreferredImage(json[0].image)
                        : setPreferredImage('');
                    json[0].hiddenImages_s
                        ? setHiddenImage(json[0].hiddenImages_s)
                        : setHiddenImage('');
                    json[0].heroDescription
                        ? setHeroDescription(json[0].heroDescription)
                        : setHeroDescription('');

                    getDescriptionsJson(json[0].guid);
                }
                setTimeout(() => filterSpeciesJson(speciesJsonFilter), 1);
            });
        });
    }

    function getDescriptionsJson(taxonID: string) {
        var lsidEncoded = encodeURIComponent(encodeURIComponent(taxonID));

        fetch(
            import.meta.env.VITE_TAXON_DESCRIPTIONS_URL +
            '/' +
            lsidEncoded.substring(lsidEncoded.length - 2) +
            '/' +
            lsidEncoded +
            '.json'
        )
            .then((response) => response.json())
            .then((json) => {
                setDescriptionJson(JSON.stringify(json, null, 2));
            })
            .catch(() => {
                // This will disable the 'loading' indicator in DescriptionView
                setDescriptionJson('');
            });
    }

    function saveImages() {
        // set preferred image, then hidden image
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                field: 'image',
                value: preferredImage,
            }),
        }).then((responsePrefer) => {
            if (responsePrefer.ok) {
                fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + auth.user?.access_token,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        taxonID: taxonID,
                        scientificName: scientificName,
                        field: 'hiddenImages_s',
                        value: hiddenImage,
                    }),
                }).then((responseHide) => {
                    setSaveImageResponse(
                        responsePrefer.status +
                        ': ' +
                        responsePrefer.statusText +
                        ', ' +
                        responseHide.status +
                        ': ' +
                        responseHide.statusText
                    );
                });
            } else {
                setSaveImageResponse(
                    responsePrefer.status + ': ' + responsePrefer.statusText
                );
            }
        });
    }

    function filterSpeciesJson(filterString: string) {
        setSpeciesJsonFilter(filterString);

        // filter each line of the taxonString
        if (filterString && taxonString) {
            let inputRows = taxonString.split('\n');
            let outputRows: string[] = [];
            inputRows.forEach((line: string) => {
                let trimed = line.trim();
                if (
                    line.indexOf(filterString) >= 0 ||
                    trimed.startsWith('[') ||
                    trimed.endsWith(']') ||
                    trimed.startsWith('{') ||
                    trimed.endsWith('}') ||
                    trimed.endsWith('],') ||
                    trimed.endsWith(': [') ||
                    trimed.endsWith(': {') ||
                    trimed.startsWith('},') ||
                    trimed.startsWith('],')
                ) {
                    outputRows.push(line);
                }
            });
            setFilteredTaxonString(outputRows.join('\n'));
        }
    }

    function loadImages() {
        fetch(
            import.meta.env.VITE_APP_BIOCACHE_URL +
            '/occurrences/search?fq=imageID:*&q=lsid:"' +
            taxonID +
            '"&fl=imageID&pageSize=' +
            imagePageSize +
            '&start=' +
            imageStart,
            {
                method: 'GET',
            }
        ).then((response) => {
            setImageStart(imageStart + imagePageSize);
            response.json().then((json) => {
                let list: string[] = [];
                for (let record of json.occurrences) {
                    list.push(record.image);
                }
                setImages([...images, ...list]);
            });
        });
    }

    // priority 0 is default, -1 is hidden, 1-5 are priority
    function getImagePriority(imageID: string): number {
        let idxPriority = preferredImage.split(',').indexOf(imageID);
        let idxHidden = hiddenImage.indexOf(imageID);
        if (idxPriority >= 0) {
            return idxPriority + 1;
        } else if (idxHidden >= 0) {
            return -1;
        }
        return 0;
    }

    function buildImageCard(imageID: string, idx: number) {
        let priority: number = getImagePriority(imageID);

        return (
            <div
                key={idx}
                className={
                    'card m-1 ' +
                    (priority > 0
                        ? 'border-success border-5'
                        : priority < 0
                            ? 'border-danger border-5'
                            : 'border-black')
                }
            >
                <a
                    className="card-img-top"
                    target="_blank"
                    href={import.meta.env.VITE_APP_IMAGE_LINK_URL + imageID}
                >
                    <img
                        src={
                            import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL +
                            imageID
                        }
                    ></img>
                </a>
                <div className="card-body d-flex flex-column">
                    <select
                        className="custom-select mt-auto"
                        value={priority}
                        onChange={(e) =>
                            changeImage(parseInt(e.target.value), imageID)
                        }
                    >
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
        );
    }

    function changeImage(priority: number, imageID: string) {
        let currentPriority = getImagePriority(imageID);
        let hiddenIdx = hiddenImage.indexOf(imageID);

        if (priority < 0 && currentPriority >= 0) {
            // add to hidden
            setHiddenImage(hiddenImage ? hiddenImage + ',' + imageID : imageID);
        } else if (priority >= 0 && hiddenIdx >= 0) {
            // remove from hidden
            setHiddenImage(
                hiddenImage
                    .split(',')
                    .filter((value) => value !== imageID)
                    .join(',')
            );
        }

        if (priority !== currentPriority) {
            // rebuild preferred list and insert or remove it
            let list: string[] = [];
            preferredImage.split(',').forEach((value) => {
                if (list.length < 5) {
                    if (list.length == priority - 1) {
                        list.push(imageID);
                    }
                }
                if (list.length < 5 && value !== imageID) {
                    list.push(value);
                }
            });

            if (priority > 0 && list.indexOf(imageID) < 0) {
                list.push(imageID);
            }

            setPreferredImage(list.join(','));
        }
    }

    function saveHeroDescription() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                field: 'heroDescription',
                value: heroDescription,
            }),
        }).then((responsePrefer) => {
            setSaveHeroDescriptionResponse(JSON.stringify(responsePrefer));
        });
    }

    function saveDescriptionJson() {
        // validate that it is JSON
        try {
            JSON.parse(descriptionJson);
        } catch (e) {
            alert('Invalid JSON');
            setSaveDescriptionJsonResponse('Invalid JSON');
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                field: 'descriptions',
                value: descriptionJson,
            }),
        }).then((responsePrefer) => {
            setSaveDescriptionJsonResponse(JSON.stringify(responsePrefer));
        });
    }

    function openLog(type: string) {
        setLogSize(100);
        setLogFilter(type);
        fetchLog(type, 100);
        setTab('log');
        window.scrollTo(0, 0);
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>

            <div className="flex-grow-1 p-3">
                {!isAdmin && !auth.isAuthenticated && (
                    <p>You must be logged in to access these tools.</p>
                )}
                {!isAdmin && auth.isAuthenticated && auth.user && (
                    <p>
                        {auth.user.profile.email} is not authorised to access
                        these tools.
                    </p>
                )}
                {isAdmin && (
                    <>
                        <Tabs
                            id="admin-tabs"
                            activeKey={tab}
                            onSelect={(k) => setTab('' + k)}
                            className=""
                        >
                            <Tab eventKey="tasks" title="Background tasks">
                                {taskString && (
                                    <pre
                                        className="alert alert-info"
                                        style={{height: '100px'}}
                                    >
                                        <small>{taskString}</small>
                                    </pre>
                                )}
                                <table className="table table-sm table-bordered">
                                    <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>Last Run</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {Object.entries(tasks).map(([key, value]) => (
                                        <tr key={key}>
                                            <td>{key}</td>
                                            <td>{value.lastRun || 'never'}</td>
                                            <td>{value.description}{value.instructions && <>
                                                <hr/>
                                                {value.instructions}</>}</td>
                                            <td>
                                                <button
                                                    className="btn btn-link"
                                                    onClick={() =>
                                                        update(key)
                                                    }>
                                                    Run now
                                                </button>
                                                <button
                                                    className="btn btn-link"
                                                    onClick={() => openLog(key)}
                                                >
                                                    View log
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </Tab>
                            <Tab eventKey="log" title="Log">
                                <div className="d-flex w-100 align-items-center alert alert-secondary">
                                    <select
                                        className="custom-select w-25"
                                        id="filter"
                                        onChange={(e) => {
                                            setLogFilter(e.target.value);
                                            fetchLog(e.target.value);
                                        }}
                                        value={logFilter}
                                    >
                                        <option value={defaultTaskFilter}>{defaultTaskFilter}</option>
                                        {Object.keys(tasks).map((type, index) => (
                                            <option key={index}>{type}</option>
                                        ))}
                                    </select>
                                    <label
                                        htmlFor="logSize"
                                        className="ms-5 me-1"
                                    >
                                        log size
                                    </label>
                                    <input
                                        id="logSize"
                                        value={logSize}
                                        onChange={(e) => {
                                            setLogSize(
                                                parseInt(e.target.value)
                                            );
                                        }}
                                    />
                                    <input
                                        type="checkbox"
                                        className="ms-5 me-2"
                                        onChange={(e) =>
                                            setShowQueue(e.target.checked)
                                        }
                                    />
                                    Show Threads & Queues
                                    <button
                                        className="btn border-black ms-5 me-5"
                                        onClick={() => fetchLog()}
                                    >
                                        Refresh Log
                                    </button>
                                </div>

                                {showQueue && (
                                    <>
                                        <pre>
                                            <small>{queueString}</small>
                                        </pre>
                                        <hr/>
                                    </>
                                )}
                                <pre>
                                    <small>{logString}</small>
                                </pre>
                            </Tab>
                            <Tab eventKey="species" title="Edit indexed taxon">
                                <div className="d-flex w-100 align-items-center alert alert-secondary">
                                    <label>
                                        Search taxon ID, linkIdentifier,
                                        scientificName, nameComplete or
                                        commonName
                                    </label>
                                    <input
                                        id="guid"
                                        className="w-50 ms-2"
                                        value={guid}
                                        onChange={(e) => {
                                            setGuid(e.target.value);
                                        }}
                                    />
                                    <button
                                        className="btn border-black ms-2"
                                        onClick={() => searchGuid()}
                                    >
                                        Search
                                    </button>
                                </div>
                                {taxonString && (
                                    <div className="">
                                        <div style={{marginTop: '30px'}}/>
                                        <Tabs
                                            id="species-tabs"
                                            activeKey={speciesTab}
                                            onSelect={(k) =>
                                                setSpeciesTab('' + k)
                                            }
                                            className="tabs-as-buttons"
                                        >
                                            <Tab
                                                eventKey="json"
                                                title="Raw indexed JSON"
                                            >
                                                <div
                                                    style={{
                                                        marginTop: '30px',
                                                    }}
                                                />
                                                <table className="table table-sm">
                                                    <thead>
                                                    <tr>
                                                        <th className="col-2"></th>
                                                        <th className="col-10"></th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    <tr>
                                                        <td>TaxonID</td>
                                                        <td>
                                                                <pre
                                                                    style={{
                                                                        whiteSpace:
                                                                            'pre-wrap',
                                                                    }}
                                                                >
                                                                    {taxonID}{' '}
                                                                    (searched
                                                                    for "
                                                                    {
                                                                        guidSearched
                                                                    }
                                                                    ")
                                                                </pre>
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                                <br/>
                                                <input
                                                    type="text"
                                                    placeholder="filter JSON"
                                                    className="w-100"
                                                    value={speciesJsonFilter}
                                                    onChange={(e) =>
                                                        filterSpeciesJson(
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                                <pre>
                                                    <small>
                                                        {filteredTaxonString ? (
                                                            <>
                                                                {
                                                                    filteredTaxonString
                                                                }
                                                            </>
                                                        ) : (
                                                            <>{taxonString}</>
                                                        )}
                                                    </small>
                                                </pre>
                                            </Tab>

                                            <Tab
                                                eventKey="images"
                                                title="Image preferences"
                                            >
                                                <div
                                                    style={{
                                                        marginTop: '30px',
                                                    }}
                                                />
                                                <table className="table table-sm">
                                                    <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th></th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    <tr>
                                                        <td>TaxonID</td>
                                                        <td>
                                                                <pre
                                                                    style={{
                                                                        whiteSpace:
                                                                            'pre-wrap',
                                                                    }}
                                                                >
                                                                    {taxonID}{' '}
                                                                    (searched
                                                                    for "
                                                                    {
                                                                        guidSearched
                                                                    }
                                                                    ")
                                                                </pre>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <label
                                                                htmlFor="preferredImage"
                                                                className="ms-auto me-1 mb-4"
                                                                style={{
                                                                    display:
                                                                        'block',
                                                                }}
                                                            >
                                                                Prefered
                                                                imageIDs
                                                                (comma
                                                                separated,
                                                                no
                                                                whitespace)
                                                            </label>
                                                            <a
                                                                target="_blank"
                                                                href={
                                                                    import.meta
                                                                        .env
                                                                        .VITE_APP_LIST_URL +
                                                                    preferredImageListID
                                                                }
                                                            >
                                                                Open
                                                                preferred
                                                                image
                                                                species list
                                                            </a>
                                                        </td>
                                                        <td>
                                                                <textarea
                                                                    className="form-control"
                                                                    id="preferredImage"
                                                                    value={
                                                                        preferredImage
                                                                    }
                                                                    rows={3}
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        setPreferredImage(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    }}
                                                                ></textarea>
                                                            <button
                                                                className="btn border-black ms-auto me-5"
                                                                onClick={() => {
                                                                    setSaveImageResponse(
                                                                        '...'
                                                                    );
                                                                    saveImages();
                                                                }}
                                                            >
                                                                Save Changes
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <label
                                                                htmlFor="hiddenImage"
                                                                className="ms-auto me-1 mb-4"
                                                                style={{
                                                                    display:
                                                                        'block',
                                                                }}
                                                            >
                                                                Hidden
                                                                imageIDs
                                                                (comma
                                                                separated,
                                                                no
                                                                whitespace)
                                                            </label>
                                                            <a
                                                                target="_blank"
                                                                href={
                                                                    import.meta
                                                                        .env
                                                                        .VITE_APP_LIST_URL +
                                                                    hiddenImageListID
                                                                }
                                                            >
                                                                Open hidden
                                                                image
                                                                species list
                                                            </a>
                                                        </td>
                                                        <td>
                                                                <textarea
                                                                    className="form-control"
                                                                    id="hiddenImage"
                                                                    value={
                                                                        hiddenImage
                                                                    }
                                                                    rows={3}
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        setHiddenImage(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    }}
                                                                ></textarea>
                                                            <button
                                                                className="btn border-black ms-auto me-5"
                                                                onClick={() => {
                                                                    setSaveImageResponse(
                                                                        '...'
                                                                    );
                                                                    saveImages();
                                                                }}
                                                            >
                                                                Save Changes
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {saveImageResponse && (
                                                        <tr>
                                                            <td>
                                                                Response
                                                                code
                                                            </td>
                                                            <td>
                                                                    <pre>
                                                                        {
                                                                            saveImageResponse
                                                                        }
                                                                    </pre>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    <tr>
                                                        <td>
                                                            Select type of
                                                            images to list
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="mb-4"
                                                                value={
                                                                    imageViewMode
                                                                }
                                                                style={{
                                                                    lineHeight:
                                                                        '34px',
                                                                    height: '34px',
                                                                    borderRadius:
                                                                        '5px',
                                                                }}
                                                                onChange={(
                                                                    e
                                                                ) =>
                                                                    setImageViewMode(
                                                                        e
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                            >
                                                                <option value="all">
                                                                    All
                                                                    Images
                                                                </option>
                                                                <option value="preferred">
                                                                    Preferred
                                                                    Images
                                                                </option>
                                                                <option value="hidden">
                                                                    Hidden
                                                                    Images
                                                                </option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                                <div className="d-flex flex-wrap">
                                                    {imageViewMode ===
                                                        'preferred' &&
                                                        preferredImage &&
                                                        preferredImage
                                                            .split(',')
                                                            .map(
                                                                (
                                                                    imageID,
                                                                    idx
                                                                ) => {
                                                                    return buildImageCard(
                                                                        imageID,
                                                                        idx
                                                                    );
                                                                }
                                                            )}
                                                    {imageViewMode ===
                                                        'hidden' &&
                                                        hiddenImage &&
                                                        hiddenImage
                                                            .split(',')
                                                            .map(
                                                                (
                                                                    imageID,
                                                                    idx
                                                                ) => {
                                                                    return buildImageCard(
                                                                        imageID,
                                                                        idx
                                                                    );
                                                                }
                                                            )}
                                                    {imageViewMode === 'all' &&
                                                        images.map(
                                                            (imageID, idx) => {
                                                                return buildImageCard(
                                                                    imageID,
                                                                    idx
                                                                );
                                                            }
                                                        )}
                                                </div>
                                                {imageViewMode === 'all' && (
                                                    <button
                                                        className="btn border-black"
                                                        onClick={() =>
                                                            loadImages()
                                                        }
                                                    >
                                                        Load More Images
                                                    </button>
                                                )}
                                            </Tab>

                                            <Tab
                                                eventKey="descriptions"
                                                title="Descriptions"
                                            >
                                                <div
                                                    style={{
                                                        marginTop: '30px',
                                                    }}
                                                />
                                                <table className="table table-sm">
                                                    <thead>
                                                    <tr>
                                                        <th className="col-4"></th>
                                                        <th className="col-8"></th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    <tr>
                                                        <td>TaxonID</td>
                                                        <td>
                                                                <pre
                                                                    style={{
                                                                        whiteSpace:
                                                                            'pre-wrap',
                                                                    }}
                                                                >
                                                                    {taxonID}{' '}
                                                                    (searched
                                                                    for "
                                                                    {
                                                                        guidSearched
                                                                    }
                                                                    ")
                                                                </pre>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            Hero description
                                                            (HTML)
                                                            <br/>
                                                            <br/>
                                                            <a
                                                                target="_blank"
                                                                href={
                                                                    import.meta
                                                                        .env
                                                                        .VITE_APP_LIST_URL +
                                                                    heroDescriptionListID
                                                                }
                                                            >
                                                                Open hero
                                                                description
                                                                list
                                                            </a>
                                                        </td>
                                                        <td>
                                                                <textarea
                                                                    id="heroDescription"
                                                                    className="w-100"
                                                                    rows={5}
                                                                    value={
                                                                        heroDescription
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        setHeroDescription(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    }}
                                                                />
                                                            <button
                                                                className="btn border-black"
                                                                onClick={() => {
                                                                    setSaveHeroDescriptionResponse(
                                                                        '...'
                                                                    );
                                                                    saveHeroDescription();
                                                                }}
                                                            >
                                                                Save Changes
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {saveHeroDescriptionResponse && (
                                                        <tr>
                                                            <td>
                                                                Response
                                                                code (Hero
                                                                Description)
                                                            </td>
                                                            <td>
                                                                    <pre>
                                                                        {
                                                                            saveHeroDescriptionResponse
                                                                        }
                                                                    </pre>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    <tr>
                                                        <td>
                                                            Descriptions
                                                            (JSON).
                                                            <ul>
                                                                <li>
                                                                    Edit the
                                                                    HTML
                                                                    category
                                                                    values.
                                                                </li>
                                                                <li>
                                                                    Edit
                                                                    fields.
                                                                    Excludes
                                                                    "name",
                                                                    "url"
                                                                    and
                                                                    "attribution"
                                                                    values.
                                                                    Excludes
                                                                    changes
                                                                    to keys.
                                                                    To
                                                                    change
                                                                    these,
                                                                    refer to
                                                                    the
                                                                    taxon-description
                                                                    tool.
                                                                </li>
                                                                <li>
                                                                    Order of
                                                                    items
                                                                    cannot
                                                                    be
                                                                    changed.
                                                                </li>
                                                                <li>
                                                                    Items
                                                                    cannot
                                                                    be
                                                                    deleted.
                                                                </li>
                                                                <li>
                                                                    Items
                                                                    cannot
                                                                    be
                                                                    added.
                                                                </li>
                                                            </ul>
                                                        </td>
                                                        <td>
                                                                <textarea
                                                                    id="descriptionJson"
                                                                    className="w-100"
                                                                    rows={20}
                                                                    value={
                                                                        descriptionJson
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        setDescriptionJson(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    }}
                                                                />
                                                            <button
                                                                className="btn border-black"
                                                                onClick={() => {
                                                                    setSaveDescriptionJsonResponse(
                                                                        '...'
                                                                    );
                                                                    saveDescriptionJson();
                                                                }}
                                                            >
                                                                Save Changes
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {saveDescriptionJsonResponse && (
                                                        <tr>
                                                            <td>
                                                                Response
                                                                code
                                                                (Description
                                                                JSON)
                                                            </td>
                                                            <td>
                                                                    <pre>
                                                                        {
                                                                            saveDescriptionJsonResponse
                                                                        }
                                                                    </pre>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    </tbody>
                                                </table>
                                            </Tab>
                                        </Tabs>
                                    </div>
                                )}
                            </Tab>
                        </Tabs>
                    </>
                )}
            </div>
        </div>
    );
}

export default AtlasAdmin;
