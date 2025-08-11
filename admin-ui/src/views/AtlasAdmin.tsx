/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {TaskType, Tasks} from '../api/sources/model.ts';
import {Tab, Tabs} from 'react-bootstrap';
import '../css/atlasAdmin.css';
import {useAuth} from 'react-oidc-context';
import Menu from '../components/menu.tsx';
import './atlasadmin.css';
import {Breadcrumb} from '@ala/common-ui';
import EditIndexedTaxon from "../components/atlas/editIndexedTaxon.tsx";

const defaultTaskFilter = '(N entries for each type)';

type ConfigEdit = {
    id: string;
    value?: string;
    notes?: string;
    updated?: number;
    newValue?: string;
    newNotes?: string;
};

function AtlasAdmin({setBreadcrumbs,}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [queueString, setQueueString] = useState('');
    const [showQueue, setShowQueue] = useState(false);
    const [logString, setLogString] = useState('');
    const [logFilter, setLogFilter] = useState('');
    const [logSize, setLogSize] = useState(100);
    const [taskString, setTaskString] = useState('');
    const [tab, setTab] = useState('species');
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
    const [dynamicConfig, setDynamicConfig] = useState<ConfigEdit[]>([]);
    const [configEdit, setConfigEdit] = useState<ConfigEdit | undefined>();

    const auth = useAuth();

    const roles = Array.isArray(auth.user?.profile?.[import.meta.env.VITE_PROFILE_ROLES])
        ? auth.user.profile[import.meta.env.VITE_PROFILE_ROLES] as string[] : [];
    const isAdmin = auth.isAuthenticated && roles.includes(import.meta.env.VITE_ADMIN_ROLE);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Search Index', href: '/atlas-admin'},
        ]);
        if (isAdmin) {
            fetchLog();
            fetchConfig();
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

    function fetchConfig() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/config', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token
            }
        }).then((response) => {
            if (response.ok) {
                response.json().then((json) => {
                    setDynamicConfig(json.sort((a: ConfigEdit, b: ConfigEdit) => {
                        if (a.id < b.id) return -1;
                        if (a.id > b.id) return 1;
                        return 0;
                    }));
                });
            } else {
                console.error('Failed to fetch dynamic config', response);
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

    function saveConfigEdit() {
        if (!configEdit || (configEdit.newValue === configEdit.value && configEdit.newNotes == configEdit.notes)) {
            // nothing to save
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/config', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: configEdit.id,
                value: configEdit.newValue,
                notes: configEdit.newNotes,
            }),
        }).then((response) => {
            if (!response.ok) {
                response.json().then((json) => {
                    alert('Failed to save config: ' + json.message);
                });
            } else {
                setConfigEdit(undefined);
                fetchConfig();
            }
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
                    <Tabs id="admin-tabs" activeKey={tab} onSelect={(k) => setTab('' + k)}>
                        <Tab eventKey="tasks" title="Background tasks">
                            {taskString && <pre className="alert alert-info" style={{height: '100px'}}>
                                <small>{taskString}</small></pre>
                            }
                            <table className="table table-sm table-bordered">
                                <thead>
                                <tr>
                                    <th>Task</th>
                                    {/*TODO: add history to the service, make use of ES. Want to know when, how long and if successful */}
                                    <th>History</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                    <tr key={key}>
                                        <td>{key}</td>
                                        <td>{value.lastRun}
                                            <br/>
                                            <span className="font-monospace">
                                            { dynamicConfig.find((it) => it.id == "schedule." + key + ".enabled")?.value?.toLowerCase() == 'true' ?
                                                    "cron: " + dynamicConfig.find((it) => it.id == "schedule." + key + ".cron")?.value : ""}
                                            </span>
                                        </td>
                                        <td>{value.description}{value.instructions && <>
                                            <hr/>
                                            {value.instructions}</>}</td>
                                        <td>
                                            <button className="btn btn-link" onClick={() => update(key)}>
                                                Run now
                                            </button>
                                            <button className="btn btn-link" onClick={() => openLog(key)}>
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
                                <select className="custom-select w-25" id="filter"
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
                                <label htmlFor="logSize" className="ms-5 me-1">log size</label>
                                <input id="logSize" value={logSize} onChange={(e) => {
                                    setLogSize(parseInt(e.target.value));}}/>
                                <input type="checkbox" className="ms-5 me-2" onChange={(e) =>
                                    setShowQueue(e.target.checked)}/>
                                Show Threads & Queues
                                <button className="btn border-black ms-5 me-5" onClick={() => fetchLog()}>
                                    Refresh Log
                                </button>
                            </div>

                            {showQueue && <><pre><small>{queueString}</small></pre><hr/></>}
                            <pre><small>{logString}</small></pre>
                        </Tab>
                        <Tab eventKey="species" title="Edit indexed taxon">
                            <EditIndexedTaxon></EditIndexedTaxon>
                        </Tab>
                        <Tab eventKey="config" title="Dynamic Config">
                            <table className="table table-striped table-bordered">
                                <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Last Changed</th>
                                    <th>Value</th>
                                    <th>Notes</th>
                                </tr>
                                </thead>
                                <tbody>
                                {dynamicConfig.map((config, idx) =>
                                    <tr key={idx}>
                                        <td>{config.id}</td>
                                        <td>{
                                            <td>{config.updated ? new Date(config.updated).toLocaleString() : ''}</td>}</td>
                                        <td className={"font-monospace"}>{config.value}</td>
                                        <td>{config.notes}</td>
                                        <td><a className="" onClick={() => {
                                            setConfigEdit({...config, newValue: config.value, newNotes: config.notes});
                                        }}>Edit</a></td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </Tab>
                    </Tabs>
                    )}
            </div>
            {configEdit && (
            <div
                className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75"
                style={{zIndex: 1050}}>
                <div className="card p-4" style={{maxWidth: '500px', width: '100%'}}>
                    <h2 className="mb-4">Edit Config Value</h2>
                    <div className="mb-3">
                        <span className="fw-bold me-2">Current value</span>
                        <code className={"border p-2"}>{configEdit.value}</code>
                    </div>
                    <div className="mb-3">
                        <span className="fw-bold me-2">New value</span>
                        <input className="form-control d-inline-block w-auto font-monospace"
                               defaultValue={configEdit.value}
                               onChange={e => setConfigEdit({...configEdit, newValue: e.target.value})}/>
                    </div>
                    <div className="mb-3">
                        <span className="fw-bold me-2">Notes</span>
                        <textarea className="form-control" rows={3} defaultValue={configEdit.notes}
                                  onChange={e => setConfigEdit({
                                      ...configEdit,
                                      newNotes: e.target.value
                                  })}></textarea>
                    </div>
                    <div className="mb-3">
                        <button className="btn btn-default" onClick={saveConfigEdit}>Save</button>
                        <button className="btn btn-default ms-2" onClick={() => setConfigEdit(undefined)}>Cancel
                        </button>
                    </div>
                </div>
            </div>
            )}
        </div>
);
}

export default AtlasAdmin;
