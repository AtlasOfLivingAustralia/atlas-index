/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


import {Breadcrumb, handleLogin, useUser} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {DoiData} from '../api/model.tsx';
import Metadata from '../components/Metadata.tsx';
import classes from './view.module.css';

interface DoiProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
    isMobile: boolean;
    doi?: string;
    breadcrumb: React.ReactNode;
}

/**
 * Home page.
 * - Landing page
 * - Overview statistics
 * - Featured DOIs
 * - Recent DOIs
 *
 * @param setBreadcrumbs
 * @constructor
 */
function Doi({setBreadcrumbs, isMobile, doi, breadcrumb}: DoiProps) {
    const [data, setData] = useState<null | DoiData>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const location = useLocation();
    const entityUid = doi ?? location.pathname.replace(/^\/doi\//, '');

    const {userInfo} = useUser();

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();

        if (setBreadcrumbs) {
            setBreadcrumbs([
                {title: 'Home', href: import.meta.env.VITE_HOME_URL},
                {title: 'ALA DOI Repository', href: '/'},
                {title: 'DOI Details', href: ''}
            ]);
        }
    }, []);

    function fetchData() {
        if (!entityUid) {
            setLoading(false);
            setData(null);
            return;
        }
        const url = import.meta.env.VITE_APP_DOI_URL + '/doi/' + entityUid;
        fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        })
            .then(response => {
                if (response.status === 404) {
                    setLoading(false);
                    setData(null);
                    setError(''); // no data is not an error
                    return;
                }
                return response.json();
            })
            .then(data => {
                // process data
                setLoading(false);
                setData(data);
                setError('');
            })
            .catch(() => {
                setLoading(false);
                setData(null);
                setError('Failed to load DOI information');
            });
    }

    function canDownload() {
        if (!data?.filename) return false;
        if (!userInfo?.authenticated) return false;

        // UI toggle only, backend will also enforce
        // Permitted when user is admin or all authorisedRoles are met
        const accessRoles: string[] = data?.authorisedRoles || [];
        if (accessRoles.length > 0) {
            return userInfo.roles?.includes(import.meta.env.VITE_APP_ROLE_ADMIN) || accessRoles.every(role => userInfo.roles?.includes(role));
        }
        return true;
    }

    function downloadUnavailableReason(): string | null {
        if (!data?.filename) return 'file not available';
        if (!userInfo?.authenticated) return 'not logged in';
        const accessRoles: string[] = data?.authorisedRoles || [];
        if (accessRoles.length > 0) {
            const hasAccess = userInfo.roles?.includes(import.meta.env.VITE_APP_ROLE_ADMIN) || accessRoles.every(role => userInfo.roles?.includes(role));
            if (!hasAccess) return 'insufficient permissions';
        }
        return null;
    }

    function download() {
        if (!data) return;

        const url = import.meta.env.VITE_APP_DOI_URL + `/doi/${data.uuid}/download?redirect=false`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userInfo?.accessToken}`
            }
        }).then(response => {
            if (response.status === 200) {
                return response.json();
            } else {
                throw new Error('Download failed');
            }
        }).then(data => {
            const location = data.url;
            if (location) {
                const link = document.createElement('a');
                link.href = location;
                link.download = '';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('Download URL not found');
            }
        }).catch(() => {
            alert('Download failed');
        });
    }

    return (
        <div className='container-fluid'>
            {!doi && (
                <div className={classes.headerLogo} style={{marginLeft: '-15px', marginRight: '-15px'}}>
                    {breadcrumb}
                    <div style={{right: '0', marginRight: (isMobile ? '15px' : '40px'), position: 'absolute'}}>
                        <a className='btn btn-primary' onClick={() => { navigate('/myDownloads'); window.scrollTo(0, 0);}}>
                            My Downloads
                        </a>
                    </div>
                    <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                        <div className='d-flex justify-content-center'>
                            <div style={{marginTop: '60px', marginBottom: '60px'}}>
                                <span
                                    style={{
                                        color: '#212121',
                                        fontSize: '44px',
                                        lineHeight: '52px',
                                        fontWeight: '600',
                                        textAlign: 'center'
                                    }}>
                                    DOI Details
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {loading && (
                <div className='d-flex justify-content-center' style={{marginTop: '100px'}}>
                    Loading...
                </div>
            )}
            {!loading && !data && !error && (
                <div className='d-flex justify-content-center' style={{marginTop: '100px'}}>
                    <span>No DOI found with ID: {entityUid}</span>
                </div>
            )}
            {!loading && error && (
                <div className='d-flex justify-content-center' style={{marginTop: '100px', color: 'red'}}>
                    <span>{error}</span>
                </div>
            )}
            {!loading && data && (
                <div className='row'
                     style={{maxWidth: '1200px', margin: '0 auto', padding: (isMobile ? '0 0px' : '0 15px'), marginTop: (isMobile ? '30px' : '60px')}}>
                    {data.active === false && (
                        <div style={{
                            background: '#ffc107',
                            color: '#212121',
                            fontWeight: 700,
                            fontSize: '20px',
                            lineHeight: '28px',
                            padding: '16px 24px',
                            borderRadius: '6px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{fontSize: '24px'}}>⚠</span>
                            Unpublished — this DOI is not publicly listed
                        </div>
                    )}
                    <div className='d-flex justify-content-center'>
                        {!loading && data && (
                            <>
                                <div style={{minHeight: '118px'}}>
                                    {data?.providerMetadata?.title && (
                                        <span
                                            style={{
                                                color: '#212121',
                                                fontSize: '32px',
                                                lineHeight: '40px',
                                                fontWeight: '600',
                                                textAlign: 'center'
                                            }}>
                                            {'Occurrence records download on ' + (data.dateCreated ? new Date(data.dateCreated).toLocaleDateString() : '')}
                                        </span>
                                    )}
                                    {data?.doi && (
                                        <div className='d-flex justify-content-center' style={{marginBottom: '30px'}}>
                                            <span
                                                style={{
                                                    fontSize: '20px',
                                                    lineHeight: '28px',
                                                    marginTop: '20px',
                                                    textAlign: 'center',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    justifyContent: 'center'
                                                }}>
                                                DOI:&nbsp;
                                                <a href={import.meta.env.VITE_APP_DOI_RESOLVER + `${doi || data.doi}`}
                                                   style={{wordBreak: 'break-all'}}>
                                                    {doi || data.doi}
                                                </a>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className='d-flex justify-content-end align-items-center' style={{gap: '16px', flexWrap: 'wrap'}}>
                        {canDownload() ? (
                            <div className='btn btn-primary' onClick={() => download()}>
                                Download file
                            </div>
                        ) : (
                            <span style={{color: '#6c757d', fontSize: '14px'}}>
                                {downloadUnavailableReason() === 'not logged in' && (
                                    <>You must <a href='#' onClick={(e) => { e.preventDefault(); handleLogin(import.meta.env.VITE_APP_API_URL); }}>log in</a> to download this file</>
                                )}
                                {downloadUnavailableReason() === 'insufficient permissions' && (
                                    <>
                                        Insufficient permissions to download this file
                                        {data?.applicationMetadata?.searchUrl && <> — <a href={data.applicationMetadata.searchUrl}>visit the search and initiate a new download</a></>}
                                    </>
                                )}
                                {downloadUnavailableReason() === 'file not available' && (
                                    <>
                                        File not available
                                        {data?.applicationMetadata?.searchUrl && <> — <a href={data.applicationMetadata.searchUrl}>visit the search and initiate a new download</a></>}
                                    </>
                                )}
                            </span>
                        )}
                    </div>
                    <Metadata data={data} isMobile={isMobile} download={canDownload() ? download : undefined} />

                    {data.displayTemplate && (
                        <>
                            <span
                                style={{
                                    fontSize: '26px',
                                    lineHeight: '32px',
                                    fontWeight: '600',
                                    marginTop: '30px',
                                    marginBottom: '10px'
                                }}>
                                Datasets
                            </span>
                            <table
                                className='table table-striped'
                                style={{
                                    fontSize: isMobile ? '14px' : '16px',
                                    lineHeight: isMobile ? '20px' : '24px',
                                    width: '100%',
                                }}>
                                <thead>
                                <tr>
                                    <th style={{minWidth: (isMobile ? '0px' : '200px')}}>Name</th>
                                    <th>Licence</th>
                                    <th style={{minWidth: (isMobile ? '0px' : '150px'), textAlign: 'right'}}>Records</th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.applicationMetadata &&
                                    data.applicationMetadata.datasets &&
                                    data.applicationMetadata.datasets.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td style={{ overflowWrap: 'anywhere'}}>{item.name}</td>
                                            <td style={{ overflowWrap: 'anywhere'}}>{item.licence}</td>
                                            <td style={{ textAlign: 'right'}}>{new Intl.NumberFormat().format(Number(item.count))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
            <div style={{height: '60px'}}></div>
        </div>
    );
}

export default Doi;
