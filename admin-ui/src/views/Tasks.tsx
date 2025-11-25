/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, useUser} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {Modal, Tab, Tabs} from "react-bootstrap";
import Menu from '../components/menu.tsx';
import optionsJson from '../config/tasks.json' with {type: 'json'};

type TaskType = {
    label: string;
    value: string;
    path: string;
    defaultJson: string;
};
const options: TaskType[] = optionsJson as TaskType[];

function Tasks({setBreadcrumbs,}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [tab, setTab] = useState('run');

    const [selected, setSelected] = useState(options[0].value);
    const [jsonText, setJsonText] = useState(options[0].defaultJson);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonResponse, setJsonResponse] = useState('');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const [taskList, setTaskList] = useState<any[]>([]);
    const [taskPage, setTaskPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [taskStatus, setTaskStatus] = useState<string | null>(null);
    const [taskType, setTaskType] = useState<string | null>(null);
    const [taskEmail, setTaskEmail] = useState<string | null>(null);
    const [taskUserId, setTaskUserId] = useState<string | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [modalTask, setModalTask] = useState<any>(null);

    const {userInfo} = useUser();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Tasks', href: '/'},
        ]);

        getTaskList();
    }, []);

    // Update textarea when selection changes
    useEffect(() => {
        const opt = options.find(o => o.value === selected);
        setJsonText(opt ? JSON.stringify(JSON.parse(opt.defaultJson), null, 2) : '');
        setJsonError(null);
    }, [selected]);

    // Validate JSON on change
    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setJsonText(value);
        try {
            JSON.parse(value);
            setJsonError(null);
        } catch {
            setJsonError('Invalid JSON');
        }
    };

    function submitTask() {
        setJsonResponse("");
        setDownloadUrl("");
        // POST the JSON to the server
        const opt = options.find(o => o.value === selected);
        if (!opt) {
            throw new Error('Selected option not found');
        }
        let path = opt.path;
        fetch(import.meta.env.VITE_APP_BIE_URL + path,
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + userInfo?.accessToken,
                    'Content-Type': 'application/json',
                },
                body: jsonText,
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Task submitted successfully:', data);
                setJsonResponse(JSON.stringify(data, null, 2));
                // If the response contains a download URL, set it
                if (data.downloadUrl) {
                    setDownloadUrl(data.downloadUrl);
                } else {
                    setDownloadUrl(null);
                }
            })
            .catch(error => {
                console.error('Error submitting task:', error);
                alert('Failed to submit task: ' + error.message);
            });
    }

    function refreshStatus() {
        // extract "statusUrl" from the JSON response
        const response = JSON.parse(jsonResponse);
        const statusUrl = response.statusUrl;
        if (!statusUrl) {
            alert('No status URL found in the response');
            return;
        }
        // GET the status from the server
        fetch(statusUrl,
            {
                headers: {
                    Authorization: 'Bearer ' + userInfo?.accessToken,
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Status refreshed successfully:', data);
                setJsonResponse(JSON.stringify(data, null, 2));
                // If the response contains a download URL, set it
                if (data.downloadUrl) {
                    setDownloadUrl(data.downloadUrl);
                } else {
                    setDownloadUrl(null);
                }
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                alert('Failed to refresh status: ' + error.message);
            });
    }

    function getTaskList(page = taskPage, status = taskStatus, type = taskType, email = taskEmail, userId = taskUserId) {
        var url = import.meta.env.VITE_APP_BIE_URL + '/admin/tasks?page=' + page;
        if (status) {
            url += '&status=' + encodeURIComponent(status);
        }
        if (type) {
            url += '&taskType=' + encodeURIComponent(type);
        }
        if (email) {
            url += '&userEmail=' + encodeURIComponent(email);
        }
        if (userId) {
            url += '&userId=' + encodeURIComponent(userId);
        }

        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + userInfo?.accessToken,
                'Content-Type': 'application/json',
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
            .then(data => {
                console.log('Tasks list refreshed successfully:', data);
                setTotalPages(data.totalPages);
                setTaskList(data.content);
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                alert('Failed to refresh status: ' + error.message);
            });
    }

    const handleShowModal = (task: any) => {
        setModalTask(task);
        setShowModal(true);
    };

    const handleCancelTask = (task: any) => {
        if (!task.cancelUrl) {
            alert('This task cannot be cancelled');
            return;
        }
        fetch(task.cancelUrl, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + userInfo?.accessToken,
                'Content-Type': 'application/json',
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
            .then(data => {
                console.log('Task cancelled successfully:', data);
                alert('Task cancelled successfully');
                getTaskList();
            })
            .catch(error => {
                console.error('Error cancelling task:', error);
                alert('Failed to cancel task: ' + error.message);
            });
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setModalTask(null);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            setTaskPage(newPage);
            getTaskList(newPage);
        }
    };

    function getStatusClass(status: string) {
        switch (status) {
            case 'CANCELLED':
                return 'text-secondary';
            case 'QUEUED':
                return 'text-info';
            case 'RUNNING':
                return 'text-primary';
            case 'FINISHED':
                return 'text-success';
            case 'ERROR':
                return 'text-danger';
            default:
                return '';
        }
    }

    return (
        <>
            <div className="d-flex flex-row">
                <Menu/>
                <div style={{flex: 1, padding: '20px'}}>
                    <Tabs id="admin-tabs" activeKey={tab} onSelect={(k) => setTab('' + k)}>
                        <Tab eventKey="run" title="Run">
                            <div style={{marginBottom: '16px', marginTop: '20px'}}>
                                <label>
                                    Task Type:&nbsp;
                                    <select
                                        value={selected}
                                        onChange={e => setSelected(e.target.value)}
                                        style={{minWidth: 200}}
                                    >
                                        {options.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                                <label>
                                    JSON Request:
                                    <textarea
                                        value={jsonText}
                                        onChange={handleJsonChange}
                                        rows={16}
                                        style={{width: '100%', fontFamily: 'monospace', fontSize: 14}}
                                    />
                                </label>
                                {jsonError && (
                                    <div style={{color: 'red', marginTop: 8}}>{jsonError}</div>
                                )}
                            </div>
                            <div style={{marginTop: '16px'}}>
                                <button className="btn btn-primary" disabled={!!jsonError}
                                        onClick={() => submitTask()}>

                                    Submit Task
                                </button>
                            </div>
                            <div style={{flex: 1, display: 'flex', flexDirection: 'column', marginTop: '16px'}}>
                                <label>
                                    JSON Response:
                                    <textarea
                                        value={jsonResponse}
                                        rows={5}
                                        style={{width: '100%', fontFamily: 'monospace', fontSize: 14}}
                                    />
                                </label>
                                {jsonError && (
                                    <div style={{color: 'red', marginTop: 8}}>{jsonError}</div>
                                )}
                            </div>
                            <div style={{marginTop: '16px'}}>
                                {!downloadUrl &&
                                    <button className="btn btn-primary"
                                            onClick={() => refreshStatus()}>
                                        Refresh Status
                                    </button>
                                }
                                {downloadUrl &&
                                    <a className={"ms-2"} href={downloadUrl} target="_blank">
                                        Download Tasks Output
                                    </a>
                                }
                            </div>
                        </Tab>
                        <Tab eventKey="list" title="List of requests">
                            <div className="mb-2 d-flex gap-2">
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Task ID"
                                    value={taskUserId ?? ''}
                                    onChange={e => {
                                        setTaskUserId(e.target.value || null);
                                    }}
                                    style={{maxWidth: 100}}
                                />
                                <select
                                    className="form-control form-control-sm"
                                    value={taskType ?? ''}
                                    onChange={e => setTaskType(e.target.value || null)}
                                    style={{maxWidth: 120}}
                                >
                                    <option value="">Task Type</option>
                                    <option value="FIELDGUIDE">FIELDGUIDE</option>
                                    <option value="SEARCH_DOWNLOAD">SEARCH_DOWNLOAD</option>
                                </select>
                                <select
                                    className="form-control form-control-sm"
                                    value={taskStatus ?? ''}
                                    onChange={e => setTaskStatus(e.target.value || null)}
                                    style={{maxWidth: 100}}
                                >
                                    <option value="">Status</option>
                                    <option value="QUEUED">QUEUED</option>
                                    <option value="RUNNING">RUNNING</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                    <option value="FINISHED">FINISHED</option>
                                    <option value="ERROR">ERROR</option>
                                </select>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Email"
                                    value={taskEmail ?? ''}
                                    onChange={e => {
                                        setTaskEmail(e.target.value || null);
                                    }}
                                    style={{maxWidth: 180}}
                                />
                                <button className="btn btn-primary" onClick={() => getTaskList()}>Apply Filter</button>
                            </div>
                            <table className="table table-striped borderless">
                                <thead>
                                <tr>
                                    <th>Task ID</th>
                                    <th>Task Type</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Started</th>
                                    <th>Duration</th>
                                    <th>Email</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {taskList.map((task, index) => (
                                    <tr key={index}>
                                        <td>{task.id}</td>
                                        <td>{task.queueRequest.taskType}</td>
                                        <td className={getStatusClass(task.status)}>{task.status}</td>
                                        <td>{task.created ? new Date(task.created).toLocaleString() : ''}</td>
                                        <td>{task.started ? new Date(task.started).toLocaleString() : ''}</td>
                                        <td>{task.started && task.liveness ? ((task.liveness - task.started) / 1000).toFixed(1) + 's' : ''}</td>
                                        <td>{task.queueRequest.email}</td>
                                        <td>
                                            <button
                                                className="btn btn-link btn-sm"
                                                onClick={() => handleShowModal(task)}
                                            >
                                                Task details
                                            </button>
                                            {task.cancelUrl && (
                                                <button
                                                    className="btn btn-link btn-sm text-danger"
                                                    onClick={() => handleCancelTask(task)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                                }
                                </tbody>
                            </table>
                            <div className="d-flex justify-content-between align-items-center">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handlePageChange(taskPage - 1)}
                                    disabled={taskPage === 0}
                                >
                                    Previous
                                </button>
                                <span>Page {taskPage + 1} of {totalPages}</span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handlePageChange(taskPage + 1)}
                                    disabled={taskPage + 1 >= totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </Tab>
                    </Tabs>

                    <Modal show={showModal} onHide={handleCloseModal} size="lg">
                        <Modal.Header closeButton>
                            <Modal.Title>Task Details</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <pre>{modalTask && JSON.stringify(modalTask, null, 2)}</pre>
                        </Modal.Body>
                        <Modal.Footer>
                            <button className="btn btn-secondary" onClick={handleCloseModal}>
                                Close
                            </button>
                        </Modal.Footer>
                    </Modal>
                </div>
            </div>
        </>
    );
}

export default Tasks;
