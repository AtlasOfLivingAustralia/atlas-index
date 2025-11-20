/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {JSX} from 'react';
import classes from './metadata.module.css';

interface MetadataProps {
    data: any;
    isMobile: boolean | undefined;
    download?: () => void;
}

function formatBinaryByteUnit(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${units[i]}`;
}

function Metadata({ data, isMobile, download }: MetadataProps) {
    function formatSearchQuery(searchUrl: string, dqFilter: { filter: string }[]): JSX.Element | null {
        if (!searchUrl) return null;

        const url = new URL(searchUrl, window.location.origin);
        const params = Array.from(url.searchParams.entries());

        return (
            <ul className='searchQueryParams'>
                {params
                    .filter(([name, value]) => {
                        return !dqFilter?.some(fq => fq.filter === value) && name !== 'disableAllQualityFilters';
                    })
                    .map(([name, value], idx) => {
                        const fieldItems = value.split(':');
                        return (
                            <li key={idx}>
                                <strong>{name}:</strong>&nbsp;
                                {fieldItems.length === 2 && value !== '*:*' ? `${fieldItems[0]}:${fieldItems[1]}` : value}
                            </li>
                        );
                    })}
            </ul>
        );
    }

    console.log('metadata', data);

    function biocache(): JSX.Element | null {
        return (
            <>
                <tr>
                    <td>Date Created</td>
                    <td>{new Date(data.dateCreated).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Record count</td>
                    <td>{data.applicationMetadata.recordCount}</td>
                </tr>
                <tr>
                    <td>Filename</td>
                    <td>{download ? <a href="#" onClick={() => download()}>{data.filename}</a> :
                        <span style={{ textDecoration: 'underline', cursor: 'default' }} title={"Insufficient permissions"}>{data.filename}</span>}</td>
                </tr>
                <tr>
                    <td>Search URL</td>
                    <td>
                        <a href={data.applicationMetadata.searchUrl} dangerouslySetInnerHTML={{ __html: data.applicationMetadata.queryTitle }} />
                    </td>
                </tr>
                <tr>
                    <td>Search query</td>
                    <td>
                        Query parameters
                        {formatSearchQuery(data.applicationMetadata.searchUrl, data.applicationMetadata.qualityFilters)}
                    </td>
                </tr>
                {data.applicationMetadata.dataProfile && (
                    <tr>
                        <td>Data profile</td>
                        <td>
                            {data.applicationMetadata.dataProfile}

                            <ul>
                                {data.applicationMetadata.qualityFilters.map((item: any, idx: number) => (
                                    <li key={idx}>{item.description || item.filter}</li>
                                ))}
                            </ul>
                        </td>
                    </tr>
                )}
                <tr>
                    <td>Licence</td>
                    <td>
                        {data.licence.length} licences
                        <ul>
                            {data.licence.map((item: any, idx: number) => (
                                <li key={idx}>{item}</li>
                            ))}
                        </ul>
                    </td>
                </tr>
                <tr>
                    <td>Citation URL</td>
                    <td>
                        <a href={import.meta.env.VITE_APP_DOI_RESOLVER + data.doi}>
                            {import.meta.env.VITE_APP_DOI_RESOLVER}
                            {data.doi}
                        </a>
                    </td>
                </tr>
            </>
        );
    }

    function csdm(): JSX.Element | null {
        return (
            <>
                <tr>
                    <td>Application</td>
                    <td>{data.applicationMetadata.applicationName}</td>
                </tr>
                <tr>
                    <td>Modeller</td>
                    <td>{data.applicationMetadata.modeller}</td>
                </tr>
                <tr>
                    <td>Organisation</td>
                    <td>{data.applicationMetadata.organisation}</td>
                </tr>
                <tr>
                    <td>Dataset annotation</td>
                    <td>{data.applicationMetadata.dataSetAnnotation}</td>
                </tr>
                <tr>
                    <td>Workflow annotation</td>
                    <td>{data.applicationMetadata.workflowAnnotation}</td>
                </tr>
                <tr>
                    <td>File</td>
                    <td>
                        <a onClick={() => download && download()}>{data.filename}</a>
                    </td>
                </tr>
                <tr>
                    <td>Record count</td>
                    <td>{data.applicationMetadata?.recordCount}</td>
                </tr>
                <tr>
                    <td>Search query</td>
                    <td>
                        Query parameters
                        {formatSearchQuery(data.applicationMetadata.searchUrl, [])}
                    </td>
                </tr>
                <tr>
                    <td>Licence</td>
                    <td>
                        {data.licence.length} licences
                        <ul>
                            {data.licence.map((item: any, idx: number) => (
                                <li key={idx}>{item}</li>
                            ))}
                        </ul>
                    </td>
                </tr>
                <tr>
                    <td>Authors</td>
                    <td>{data.authors}</td>
                </tr>
                <tr>
                    <td>Date created</td>
                    <td>{new Date(data.dateCreated).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Citation URL</td>
                    <td>
                        <a href={import.meta.env.VITE_APP_DOI_RESOLVER + data.doi}>
                            {import.meta.env.VITE_APP_DOI_RESOLVER}
                            {data.doi}
                        </a>
                    </td>
                </tr>
            </>
        );
    }

    function renderMetadata(metadata: any): JSX.Element {
        if (!metadata) return <></>;

        // If metadata is a Map-like object (not array, not primitive)
        if (typeof metadata === 'object' && !Array.isArray(metadata)) {
            return (
                <>
                    {Object.entries(metadata).map(([key, value], idx) => (
                        <div className='row' key={idx} style={{ marginBottom: '10px' }}>
                            <div className='col-md-2'>
                                <strong>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, str => str.toUpperCase())}:</strong>
                            </div>
                            <div className='col-md-10'>{renderMetadata(value)}</div>
                        </div>
                    ))}
                </>
            );
        }

        // If metadata is an array/collection
        if (Array.isArray(metadata)) {
            return (
                <>
                    {metadata.map((item, idx) => (
                        <div className='panel panel-default' key={idx}>
                            <div className='panel-body'>{renderMetadata(item)}</div>
                        </div>
                    ))}
                </>
            );
        }

        // Otherwise, render primitive value
        return <>{String(metadata)}</>;
    }

    function defaultMetadata(): JSX.Element | null {
        return (
            <>
                <tr>
                    <td>Description</td>
                    <td>{data.description}</td>
                </tr>
                <tr>
                    <td>Date Created</td>
                    <td>{new Date(data.dateCreated).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Licence</td>
                    <td>
                        {data.licence.length} licences
                        <ul>
                            {data.licence.map((item: any, idx: number) => (
                                <li key={idx}>{item}</li>
                            ))}
                        </ul>
                    </td>
                </tr>
                {data.customLandingPageUrl && (
                    <tr>
                        <td>Landing page</td>
                        <td>
                            This DOI was registered with an application-specific landing page. <a href={data.customLandingPageUrl}> View the application landing page.</a>
                        </td>
                    </tr>
                )}
                {data.fileHash && (
                    <tr>
                        <td>File SHA-256</td>
                        <td>
                            {Array.from(new Uint8Array(data.fileHash))
                                .map(b => b.toString(16).padStart(2, '0'))
                                .join('')}
                        </td>
                    </tr>
                )}
                {data.fileSize && (
                    <tr>
                        <td>File Size</td>
                        <td>{formatBinaryByteUnit(data.fileSize)}</td>
                    </tr>
                )}
                <tr>
                    <td>Additional</td>
                    <td>{renderMetadata(data.applicationMetadata)}</td>
                </tr>
            </>
        );
    }

    return (
        <>
            <span style={{ fontSize: '26px', lineHeight: '32px', fontWeight: '600', marginBottom: '10px' }}>Metadata</span>
            <table className={'table table-striped ' + classes.metadataTable} style={{ fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px' }}>
                <thead>
                    <tr>
                        <th style={{ width: '150px' }}>Name</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>{data.displayTemplate == 'biocache' ? biocache() : data.displayTemplate == 'csdm' ? csdm() : defaultMetadata()}</tbody>
            </table>
        </>
    );
}

export default Metadata;
