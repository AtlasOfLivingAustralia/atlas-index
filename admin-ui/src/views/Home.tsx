/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import Menu from '../components/menu.tsx';
import { Breadcrumb } from '@ala/common-ui';

const panelStyle = {
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    padding: '20px',
    background: '#eee',
    minWidth: '220px',
    marginRight: '20px',
    marginBottom: '20px',
    flex: 1,
};

const statusUpdates = [
    { date: '2024-06-10', status: 'Success' },
    { date: '2024-06-09', status: 'Failure' },
    { date: '2024-06-08', status: 'Success' },
    { date: '2024-06-07', status: 'Success' },
    { date: '2024-06-06', status: 'Success' },
];

function Home({
    setBreadcrumbs,
}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Admin', href: '/' },
        ]);
    }, []);

    return (
        <>
            <div className="d-flex flex-row">
                <Menu />

                <div style={{ flex: 1, padding: '20px' }}>
                    <p>
                        Welcome to the admin interface. Use the links on the
                        left to get started.
                    </p>

                    <p>A fake dashboard below.</p>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            marginTop: '60px',
                        }}
                    >
                        <div style={panelStyle}>
                            <h4>Index Size</h4>
                            <div
                                style={{ fontSize: '2rem', fontWeight: 'bold' }}
                            >
                                4,123,829
                            </div>
                        </div>

                        <div style={panelStyle}>
                            <h4>Status</h4>
                            <div>
                                <strong>RabbitMQ Queue Size:</strong> 128
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <strong>Last 5 Search Index Updates:</strong>
                                <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                    {statusUpdates.map((u, i) => (
                                        <li
                                            key={i}
                                            style={{
                                                color:
                                                    u.status === 'Success'
                                                        ? 'green'
                                                        : 'red',
                                            }}
                                        >
                                            {u.date}: {u.status}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div style={panelStyle}>
                            <h4>Data Quality Profiles</h4>
                            <div
                                style={{ fontSize: '2rem', fontWeight: 'bold' }}
                            >
                                17
                            </div>
                            <div
                                style={{
                                    fontSize: '0.9rem',
                                    color: '#666',
                                    marginTop: '8px',
                                }}
                            >
                                Last Updated: 2024-06-10 12:34:56
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Home;
