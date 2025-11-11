/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, Pagination} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {DoiData} from '../api/model.tsx';
import featured from '../config/homeFeatured.json';
// using static data for now
import summary from '../config/homeSummary.json';
import classes from './view.module.css';

interface HomeProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
    isMobile: boolean;
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
function Home({setBreadcrumbs, isMobile}: HomeProps) {
    const [page, setPage] = useState<number>(0);
    const [maxResults, setMaxResults] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [recent, setRecent] = useState<DoiData[]>([]);
    const pageSize = 10;
    const deepPagingMaxPage = Math.floor(10000 / pageSize); // Nominated limit

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();

        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'ALA DOI Repository', href: ''}
        ]);
    }, []);

    function fetchData(newPage?: number) {
        const thisPage = newPage !== undefined ? newPage : page;

        const url = import.meta.env.VITE_APP_DOI_URL + `/doi?max=${pageSize}&offset=${thisPage * pageSize}&sort=dateMinted&order=desc`;
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
                setRecent(data);
            })
            .catch(() => {
                setLoading(false);
                setMaxResults(0);
            });
    }

    function updatePage(newPage: number) {
        setPage(() => newPage);
        setLoading(true);
        fetchData(newPage);
    }

    return (
        <div className='container-fluid' style={{marginTop: '-47px'}}>
            <div className={classes.headerLogo} style={{marginLeft: '-15px', marginRight: '-15px'}}>
                <div style={{float: 'right', marginTop: '12px', marginRight: '40px'}}>
                    <a
                        style={{zIndex: '1', position: 'relative'}}
                        className='btn btn-primary btn-large'
                        onClick={() => {
                            navigate('/myDownloads');
                            window.scrollTo(0, 0);
                        }}>
                        My Downloads
                    </a>
                </div>
                <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '52px',
                                lineHeight: '58px',
                                fontWeight: '600',
                                textAlign: 'center',
                                marginTop: '60px'
                            }}>
                            ALA DOI Repository
                        </span>
                    </div>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '32px',
                                lineHeight: '40px',
                                fontWeight: '600',
                                textAlign: 'center',
                                marginTop: '60px'
                            }}>
                            Discover, access, and cite Australia's biodiversity data with persistent digital identifiers
                        </span>
                    </div>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '20px',
                                lineHeight: '28px',
                                fontWeight: '400',
                                textAlign: 'center',
                                marginTop: '20px'
                            }}>
                            A digital object identifier (DOI) is a unique alphanumeric string assigned by a registration agency (the International DOI Foundation) to identify content and provide a persistent link to its location on the Internet.
                        </span>
                    </div>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '32px',
                                lineHeight: '40px',
                                fontWeight: '600',
                                textAlign: 'center',
                                marginTop: '60px'
                            }}>
                            Empowering research through open data
                        </span>
                    </div>

                    {summary && summary.length > 0 &&
                        <div className='d-flex flex-wrap justify-content-center' style={{marginTop: '40px'}}>
                            {summary.map((box, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: '#fff',
                                        borderRadius: '10px',
                                        padding: '30px 10px 0px 10px',
                                        height: '150px',
                                        width: '270px',
                                        margin: '10px'
                                    }}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '32px',
                                            lineHeight: '40px',
                                            textAlign: 'center',
                                            color: '#003A70'
                                        }}>
                                        {box.value}
                                    </div>
                                    <p
                                        style={{
                                            textAlign: 'center',
                                            marginTop: '5px',
                                            fontSize: '22px',
                                            lineHeight: '28px'
                                        }}>
                                        {box.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    }

                    <div style={{height: '60px'}}></div>
                </div>
            </div>

            { featured && featured.length > 0 &&
                <div className='row' style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                    <div style={{position: 'relative', marginTop: '60px', minHeight: '60px'}}>
                        <span
                            style={{
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                color: '#212121',
                                fontSize: '32px',
                                lineHeight: '40px',
                                fontWeight: '600',
                                textAlign: 'center'
                            }}>
                            Featured DOIs
                        </span>
                    </div>
                    <div className='d-flex justify-content-center'>
                        <span
                            style={{
                                fontSize: '20px',
                                lineHeight: '28px',
                                marginTop: '20px',
                                textAlign: 'center'
                            }}>
                            A selection of curated, static downloads.
                        </span>
                    </div>
                    <div className='d-flex flex-wrap justify-content-center' style={{marginTop: '40px'}}>
                        {featured.map((box, idx) => (
                            <div
                                key={idx}
                                style={{
                                    background: '#F2F2F2',
                                    borderRadius: '10px',
                                    padding: '10px',
                                    height: '100px',
                                    width: '270px',
                                    margin: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title={box.label}>
                                <a href={box.url}>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            fontSize: '22px',
                                            lineHeight: '28px',
                                            color: '#003A70',
                                            textDecoration: 'underline'
                                        }}>
                                        {box.label}
                                    </div>
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            }

            <div className='row' style={{maxWidth: '1200px', margin: '0 auto', padding: '0 15px'}}>
                <div style={{position: 'relative', marginTop: '60px', minHeight: '60px'}}>
                    <span
                        style={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            color: '#212121',
                            fontSize: '32px',
                            lineHeight: '40px',
                            fontWeight: '600',
                            textAlign: 'center'
                        }}>
                        Recent DOIs
                    </span>
                </div>
                <div className='d-flex align-items-center flex-wrap gap-2' style={{marginTop: '20px'}}>
                    <span className={classes.resultsTitle}>Showing</span>
                    {maxResults > 0 && (
                        <span className={classes.resultsTitleBold}>
                            {page * pageSize + 1}-{maxResults < (page + 1) * pageSize ? maxResults : (page + 1) * pageSize}
                        </span>
                    )}
                    {maxResults > 0 && <span className={classes.resultsTitle}>of</span>}
                    <span className={classes.resultsTitleBold}>{new Intl.NumberFormat('en').format(maxResults)}</span>
                    <span className={classes.resultsTitle}>results</span>
                </div>
                <div style={{marginTop: '30px', minHeight: '600px'}}>
                    {loading && (
                        <div className='placeholder-glow'>
                            <span
                                className='placeholder w-100'
                                style={{
                                    borderRadius: '10px',
                                    height: '455px',
                                    width: '100%',
                                    marginBottom: '30px',
                                    padding: '20px'
                                }}></span>
                        </div>
                    )}
                    {!loading && (
                        <table className='table table-striped'
                               style={{fontSize: '20px', lineHeight: '28px', color: '#212121'}}>
                            <thead style={{fontWeight: 600}}>
                            <tr>
                                <th>DOI</th>
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
                                            navigate(`/doi/${data.uuid}`);
                                            window.scrollTo(0, 0);
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
                    )}

                    <Pagination page={page} maxResults={maxResults} pageSize={pageSize}
                                deepPagingMaxPage={deepPagingMaxPage} onPageChange={updatePage} isMobile={isMobile}/>
                </div>
            </div>
            <div style={{height: '60px'}}></div>
        </div>
    );
}

export default Home;
