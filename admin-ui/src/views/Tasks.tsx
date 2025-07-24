/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import Menu from '../components/menu.tsx';
import { Breadcrumb } from '@ala/common-ui';
import {useAuth} from "react-oidc-context";

const options = [
    { label: 'FIELDGUIDE V2', value: 'FIELDGUIDE_V2', path: '/v2/download/fieldguide', defaultJson: '{"filename": "koala-fieldguide.pdf","title": "Koala Fieldguide","sourceUrl": "https://biocache.ala.org.au/occurrences/search?q=koala","id": ["https://biodiversity.org.au/afd/taxa/1e389027-e5b9-48c8-844f-3f7a3c62484c","https://biodiversity.org.au/afd/taxa/88bae719-0e10-480e-ad3d6969e523ce03","https://biodiversity.org.au/afd/taxa/055efa94-ba0b-4f6b-9f44-51d4b9905846","https://www.catalogueoflife.org/data/taxon/6NLJ8","https://biodiversity.org.au/afd/taxa/e9d6fbbd-1505-4073-990a-dc66c930dad6","https://biodiversity.org.au/afd/taxa/4f55b6d6-30e5-41a5-a2e2-ebcccbfbe009"]}' },
    // { label: 'SANDBOX V2', value: 'SANDBOX_V2', path: '/v2/download/sandbox', defaultJson: '{\n  "taskType": "SANDBOX",\n  "params": {}\n}' },
    { label: 'SEARCH_DOWNLOAD V2', value: 'SEARCH_DOWNLOAD_V2', path: '/v2/download/search', defaultJson: '{ "q": [ "Koala", "idxtype:TAXON" ], "filename": "koala-taxon-search", "fl": [ "guid", "id", "scientificName", "rank", "rk_kingdom" ]}' },
];

function Tasks({
    setBreadcrumbs,
}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [selected, setSelected] = useState(options[0].value);
    const [jsonText, setJsonText] = useState(options[0].defaultJson);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonResponse, setJsonResponse] = useState('');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const auth = useAuth();

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Tasks', href: '/' },
        ]);
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
        // POST the JSON to the server
        const opt = options.find(o => o.value === selected);
        if (!opt) {
            throw new Error('Selected option not found');
        }
        let path = opt.path;
        fetch( import.meta.env.VITE_APP_BIE_URL + path,
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + auth.user?.access_token,
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
        fetch(statusUrl)
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

    return (
        <>
            <div className="d-flex flex-row">
                <Menu />
                <div style={{ flex: 1, padding: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label>
                            Task Type:&nbsp;
                            <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                style={{ minWidth: 200 }}
                            >
                                {options.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <label>
                            JSON Request:
                            <textarea
                                value={jsonText}
                                onChange={handleJsonChange}
                                rows={16}
                                style={{ width: '100%', fontFamily: 'monospace', fontSize: 14 }}
                            />
                        </label>
                        {jsonError && (
                            <div style={{ color: 'red', marginTop: 8 }}>{jsonError}</div>
                        )}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <button className="btn btn-primary" disabled={!!jsonError}
                        onClick={() => submitTask()}>

                            Submit Task
                        </button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
                        <label>
                            JSON Response:
                            <textarea
                                value={jsonResponse}
                                rows={5}
                                style={{ width: '100%', fontFamily: 'monospace', fontSize: 14 }}
                            />
                        </label>
                        {jsonError && (
                            <div style={{ color: 'red', marginTop: 8 }}>{jsonError}</div>
                        )}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        {!downloadUrl &&
                            <button className="btn btn-primary"
                                    onClick={() => refreshStatus()}>
                                Refresh Status
                            </button>
                        }
                        {downloadUrl &&
                            <a className={"ms-2"} href={downloadUrl}>
                                Download Tasks Output
                            </a>
                        }
                    </div>
                </div>
            </div>
        </>
    );
}

export default Tasks;
