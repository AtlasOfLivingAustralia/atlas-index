/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, handleLogin, Pagination, useUser} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {DoiData} from "../api/model.tsx";
import Doi from './Doi.tsx';
import classes from './view.module.css';

interface MyDownloadsProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
    isMobile: boolean;
}

type DownloadStatusDTO = {
    status: string;
    totalRecords: number;
    records?: number;
    cancelUrl?: string;
    message?: string;
    error?: string;
};

type DownloadsMap = {
    [email: string]: DownloadStatusDTO[];
};

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
function MyDownloads({setBreadcrumbs, isMobile}: MyDownloadsProps) {
    const [page, setPage] = useState<number>(0);
    const [maxResults, setMaxResults] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [recent, setRecent] = useState<DoiData[]>([]);
    const pageSize = 10;
    const deepPagingMaxPage = Math.floor(10000 / pageSize); // 10k == elasticsearch configured limit

    const [downloads, setDownloads] = useState<DownloadsMap | undefined>(undefined);

    const [showDoiModal, setShowDoiModal] = useState(false);
    const [selectedDoi, setSelectedDoi] = useState<string | null>(null);

    const navigate = useNavigate();

    const {userInfo} = useUser();

    useEffect(() => {
        // login is mandatory for this page
        if (!userInfo) {
            // still checking if logged in or not
            return;
        }
        if (userInfo && !userInfo.authenticated) {
            // redirect to the login page
            handleLogin(import.meta.env.VITE_APP_API_URL);
            return;
        }

        fetchData();

        fetchDownloads();

        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'ALA DOI Repository', href: '/'},
            {title: 'My Downloads', href: ''}
        ]);
    }, [userInfo]);

    // stop background scrolling when modal is open
    useEffect(() => {
        if (showDoiModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showDoiModal]);

    function fetchDownloads() {
        setDownloads(undefined);
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/offline/status', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + userInfo?.accessToken,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            response.json().then(json => {
                if (response.ok) {
                    setDownloads(json);
                }
            });
        });
    }

    function fetchData(newPage?: number) {
        const pageToFetch = newPage !== undefined ? newPage : page;

        if (!userInfo) {
            setLoading(false);
            setRecent([]);
            return;
        }

        setLoading(true);

        const url = import.meta.env.VITE_APP_DOI_URL + `/doi?max=${pageSize}&offset=${pageToFetch * pageSize}&sort=dateCreated&order=desc&userId=${userInfo?.userId}`;
        fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        })
            .then(response => {
                const totalCount = response.headers.get('x-total-count');
                setMaxResults(totalCount ? parseInt(totalCount, 10) : 0);
                return response.json();
            })
            .then(data => {
                // process data
                setLoading(false);
                // const recentDOIs: RecentDOI[] = data.map((item: any) => ({
                //     //item.providerMetadata.title,
                //     text: 'Occurrence records download on ' + new Date(item.dateCreated).toLocaleDateString(),
                //     url: `/doi/${item.uuid}`,
                //     searchUrl: item.applicationMetadata?.searchUrl,
                //     doi: item.doi,
                //     created: new Date(item.dateCreated).toLocaleDateString(),
                //     authors: item.authors,
                //     description: item.description,
                //     records: item.applicationMetadata?.recordCount,
                //     datasets: item.applicationMetadata?.datasets,
                //     applicationMetadata: item.applicationMetadata,
                //     dateCreated: item.dateCreated,
                //     filename: item.filename,
                //     licence: item.licence,
                //     displayTemplate: item.displayTemplate,
                //     title: item.title
                // }));
                setRecent(data);
            })
            .catch(() => {
                setLoading(false);
                setMaxResults(0);
            });
    }

    function updatePage(newPage: number) {
        window.scrollTo({top: 0, behavior: 'smooth'});
        setPage(() => newPage);
        setLoading(true);
        fetchData(newPage);
    }

    function cancelDownload(cancelUrl: string | undefined) {
        if (!cancelUrl) {
            return;
        }

        if (window.confirm('Cancel Download\n\nAre you sure you want to cancel this download?')) {
            fetch(cancelUrl, {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + userInfo?.accessToken,
                    'Content-Type': 'application/json'
                }
            })
                .then(_ => fetchDownloads())
                .catch(err => alert('Cancel failed: ' + err));
        }
    }

    return (
        <div className='container-fluid' style={{marginTop: '-47px'}}>
            <div className={classes.headerLogo} style={{marginLeft: '-15px', marginRight: '-15px'}}>
                <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 40px'}}>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '44px',
                                lineHeight: '52px',
                                fontWeight: '600',
                                textAlign: 'center',
                                marginTop: '60px',
                                marginBottom: '60px'
                            }}>
                            My Downloads
                        </span>
                    </div>
                </div>
            </div>

            <div className='row' style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px', marginTop: '60px'}}>
                {downloads && Object.entries(downloads).length > 0 && (
                    <>
                        <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                            <div className='d-flex justify-content-center'>
                                <div style={{marginBottom: '30px'}}>
                                    <span
                                        style={{
                                            color: '#212121',
                                            fontSize: '26px',
                                            lineHeight: '32px',
                                            fontWeight: '600',
                                            textAlign: 'center'
                                        }}>
                                        Active downloads
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <table className='table table-striped'
                                   style={{fontSize: '20px', lineHeight: '28px', color: '#212121'}}>
                                <thead style={{fontWeight: 600}}>
                                <tr>
                                    <th>Email</th>
                                    <th style={{width: '120px'}}>Status</th>
                                    <th style={{width: '120px', textAlign: 'right'}}>Progress</th>
                                    <th style={{width: '180px', textAlign: 'right'}}>Total Records</th>
                                    <th style={{width: '100px'}}></th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(downloads).map(([email, userDownloads]) =>
                                    userDownloads.map((row: DownloadStatusDTO, idx: number) => (
                                        <tr key={email + '-' + idx}>
                                            <td>{email}</td>
                                            <td>{row.records == row.totalRecords ? 'finalising' : row.status}</td>
                                            <td style={{textAlign: 'right'}}>{row.records ? new Intl.NumberFormat('en').format(row.records) : ''}</td>
                                            <td style={{textAlign: 'right'}}>{new Intl.NumberFormat('en').format(row.totalRecords)}</td>
                                            <td>
                                                <button
                                                    onClick={() => {
                                                        cancelDownload(row.cancelUrl);
                                                    }}
                                                    style={{
                                                        color: '#c00',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline'
                                                    }}>
                                                    Cancel
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                            <div className='d-flex justify-content-center'>
                                <div style={{marginTop: '60px', marginBottom: '30px'}}>
                                    <span
                                        style={{
                                            color: '#212121',
                                            fontSize: '26px',
                                            lineHeight: '32px',
                                            fontWeight: '600',
                                            textAlign: 'center'
                                        }}>
                                        Previous downloads
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {maxResults == 0 && !loading && <div className='d-flex justify-content-center' style={{fontSize: '20px'}}>You don’t have any DOI downloads yet.</div>}
                {maxResults > 0 &&
                    <div className='d-flex align-items-center flex-wrap gap-2' style={{marginTop: '0px'}}>
                        <span className={classes.resultsTitle}>Showing</span>
                        {maxResults > 0 && (
                            <span className={classes.resultsTitleBold}>
                                {page * pageSize + 1}-{maxResults < (page + 1) * pageSize ? maxResults : (page + 1) * pageSize}
                            </span>
                        )}
                        {maxResults > 0 && <span className={classes.resultsTitle}>of</span>}
                        <span className={classes.resultsTitleBold}>{new Intl.NumberFormat('en').format(maxResults)}</span>
                    </div>
                }
                <div style={{marginTop: '30px'}}>
                    {loading && (
                        <div className='placeholder-glow' style={{}}>
                            <span
                                className='placeholder w-100 h-100'
                                style={{
                                    borderRadius: '10px',
                                    minHeight: '150px',
                                    width: '100%',
                                    marginBottom: '30px',
                                    padding: '20px'
                                }}></span>
                        </div>
                    )}

                    {!loading && maxResults > 0 && (<>
                            <table className='table table-striped'
                                   style={{fontSize: '20px', lineHeight: '28px', color: '#212121'}}>
                                <thead style={{fontWeight: 600}}>
                                <tr>
                                    <th>Title</th>
                                    <th style={{width: '100px'}}>Created</th>
                                    <th style={{width: '120px', textAlign: 'right'}}>Records</th>
                                    <th style={{width: '120px', textAlign: 'right'}}>Datasets</th>
                                </tr>
                                </thead>
                                <tbody style={{cursor: 'pointer'}}>
                                {recent &&
                                    recent.map((data, idx) => (
                                        <tr
                                            key={idx}
                                            onClick={() => {
                                                // mobile -> open DOI page directly
                                                // desktop -> open modal
                                                if (isMobile) {
                                                    navigate(`/doi/${data.uuid}`);
                                                    window.scrollTo(0, 0);
                                                } else {
                                                    setSelectedDoi(data.doi);
                                                    setShowDoiModal(true);
                                                }
                                            }}
                                            style={{height: '42px'}}>
                                            <td
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: '400px'
                                                }}>
                                                {data.title}
                                                <br/>
                                                <span style={{color: '#888', fontSize: '16px'}}>
                                                    {data.doi}
                                                    <br/>
                                                    {data.description}
                                                </span>
                                            </td>
                                            <td>{data.dateCreated ? new Date(data.dateCreated).toLocaleDateString() : ''}</td>
                                            <td style={{textAlign: 'right'}}>{data.applicationMetadata?.recordCount ? new Intl.NumberFormat().format(Number(data.applicationMetadata?.recordCount)) : ''}</td>
                                            <td style={{textAlign: 'right'}}>{data.applicationMetadata?.datasets?.length}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination page={page} maxResults={maxResults} pageSize={pageSize}
                                        deepPagingMaxPage={deepPagingMaxPage} onPageChange={updatePage}
                                        isMobile={isMobile}/>
                        </>
                    )}
                </div>
            </div>
            <div style={{height: '60px'}}></div>
            {showDoiModal && selectedDoi && (
                <div
                    className='modal-backdrop'
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 1050,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}

                    onClick={() => setShowDoiModal(false)}>
                    <div
                        className='modal-content'
                        style={{
                            position: 'relative',
                            background: '#fff',
                            borderRadius: '8px',
                            padding: '5px',
                            width: '90vw',
                            height: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                className='btn btn-link'
                                style={{
                                    top: '12px',
                                    right: '12px',
                                    fontSize: '24px',
                                    color: '#212121',
                                    textDecoration: 'none',
                                    zIndex: 2
                                }}
                                aria-label='Close'
                                onClick={() => setShowDoiModal(false)}>
                                &times;
                            </button>
                        </div>
                        <Doi doi={selectedDoi} setBreadcrumbs={function (_: Breadcrumb[]): void {
                        }} isMobile={false}/>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyDownloads;
