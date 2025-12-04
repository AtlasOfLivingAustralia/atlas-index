/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import Menu from '../components/menu.tsx';
import {Breadcrumb, useUser} from '@ala/common-ui';
import {Tab, Tabs} from "react-bootstrap";

type DownloadStatusDTO = {
    status: string;
    totalRecords: number;
    records?: number;
    statusUrl: string;
    downloadUrl?: string;
    cancelUrl?: string;
    message?: string;
    error?: string;
    userId?: string;
};

type DownloadsMap = {
    [email: string]: DownloadStatusDTO[];
};

function Biocache({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {
    const [tab, setTab] = useState('downloads');
    const [downloads, setDownloads] = useState<DownloadsMap | undefined>(undefined);

    const {userInfo} = useUser();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Biocache', href: '/'},
        ]);

        fetchDownloads();
    }, []);

    function fetchDownloads() {
        setDownloads(undefined);
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/offline/status/all', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + userInfo?.accessToken,
                'Content-Type': 'application/json',
            }
        }).then((response) => {
            response.json().then((json) => {
                if (response.ok) {
                    setDownloads(json);
                }
            })});
    }

    function cancelDownload(cancelUrl: string | undefined) {
        if (!cancelUrl) {
            return;
        }

        if (window.confirm('Are you sure you want to cancel this download?')) {
            fetch(cancelUrl, {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + userInfo?.accessToken,
                    'Content-Type': 'application/json',
                }
            })
                .then(response => response.json())
                .then(json => {
                    alert('Cancelled: ' + JSON.stringify(json));

                    // refresh list
                    fetchDownloads();
                })
                .catch(err => alert('Cancel failed: ' + err));
        }
    }

    return (
        <>
            <div className="d-flex flex-row">
                <Menu/>
                <div style={{flex: 1, padding: '20px'}}>
                    <Tabs id="admin-tabs" activeKey={tab} onSelect={(k) => setTab('' + k)}>
                        <Tab eventKey="downloads" title="Active downloads">
                            <div className="mb-2 gap-2 mt-5">
                                <table className="table table-striped">
                                    <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Records</th>
                                        <th>Total Records</th>
                                        <th></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {downloads == undefined && <tr><td colSpan={5}>Loading...</td></tr>}
                                    {downloads != undefined && Object.entries(downloads).length == 0 && <tr><td colSpan={5}>None found</td></tr>}
                                    {downloads && Object.entries(downloads).map(([email, userDownloads]) => (
                                        userDownloads.map((row: DownloadStatusDTO, idx: number) => (
                                            <tr key={email + '-' + idx}>
                                                <td>{email}</td>
                                                <td>{row.status}</td>
                                                <td>{row.records}</td>
                                                <td>{row.totalRecords}</td>
                                                <td>
                                                    <button onClick={() => { cancelDownload(row.cancelUrl); }}
                                                            style={{ color: '#c00', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                                        Cancel
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </Tab>
                        <Tab eventKey="requests" title="Admin requests">
                            <div className="mb-2 gap-2 mt-5">
                                2nd
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </>
    );
}

export default Biocache
;
