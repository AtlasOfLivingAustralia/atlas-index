/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import Menu from '../components/menu.tsx';
import { Breadcrumb } from '@ala/common-ui';
import {useAuth} from "react-oidc-context";

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

type Stats = {
    elasticsearch?: {
        idxtype?: Record<string, number | string | undefined | null>;
    };
    rabbitmq?: Record<string, number | string | undefined | null>;
    tables?: Record<string, number | string | undefined | null>;
};

function Home({
    setBreadcrumbs,
}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [stats, setStats] = useState<Stats>({});
    const [testResult, setTestResult] = useState({});

    const auth = useAuth();

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Admin', href: '/' },
        ])

        fetchStats();
    }, []);

    function fetchStats() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/info', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token
            }
        }).then((response) => {
            response.json().then((json) => {
                if (response.ok) {
                    setStats(json);
                }
            });
        });
    }


    function doTest() {
        setTestResult({"waiting": true});
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/test', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token
            }
        }).then((response) => {
            response.json().then((json) => {
                if (response.ok) {
                    setTestResult(json);
                } else {
                    setTestResult({"http error": "response status: " + response.status, "message": json.message});
                }
            });
        });
    }

    return (
        <>
            <div className="d-flex flex-row">
                <Menu />

                <div style={{ flex: 1, padding: '20px' }}>
                    <p>
                        Welcome to the admin interface. Use the links on the
                        left to get started.
                    </p>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            marginTop: '60px',
                        }}
                    >
                        <div style={panelStyle}>
                            <h4>Elasticsearch</h4>
                            <div
                                style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    flexWrap: 'wrap'
                                }}
                            >
                             {stats?.elasticsearch?.idxtype &&
                                    Object.entries(stats.elasticsearch.idxtype)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([key, value], idx) => (
                                            <div key={idx} style={{ width: '200px'}}>
                                                <code>{key}</code>: <span style={{fontWeight: "normal"}}>{value}</span>
                                            </div>
                                        ))
                                }
                            </div>
                        </div>

                        <div style={panelStyle}>
                            <h4>RabbitMQ</h4>
                            <div>
                                {stats?.rabbitmq &&
                                    Object.entries(stats.rabbitmq)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([key, value], idx) => (
                                            <div key={idx}>
                                                <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong>
                                                &nbsp;{value}
                                            </div>
                                        ))
                                }
                            </div>
                        </div>

                        <div style={panelStyle}>
                            <h4>Postgres</h4>
                            <div>
                                {stats?.tables &&
                                    Object.entries(stats.tables)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([key, value], idx) => (
                                            <div key={idx}>
                                                <code><strong>{key}:</strong></code>
                                                &nbsp;{value}
                                            </div>
                                        ))
                                }
                            </div>
                        </div>
                    </div>

                    <div className="card mt-2">
                        <div className="card-header">
                            Test Connectivity
                        </div>
                        <div className="card-body">
                            <span className="mt-4">Basic test for elasticsearch connectivity, rabbitmq connnectivity, file stores (data, download, static)</span>
                            <br/>
                            <button className="btn btn-primary mt-2" onClick={doTest}>Begin test</button>
                            <div style={{boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '1px solid #ccc', padding: '15px', marginTop: '20px', background: '#e9e9e9'}}>
                                <pre>{JSON.stringify(testResult, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Home;
