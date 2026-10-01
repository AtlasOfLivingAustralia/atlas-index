/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FlaggedAlert} from '@ala/common-ui';
import {JSX, useEffect, useState} from 'react';
import FormatName from '../nameUtils/formatName';
import classes from './species.module.css';

interface MapViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

interface Resource {
    name: string | JSX.Element;
    url: string;
    external?: boolean;
    rules?: {
        inSpeciesGroup?: string[];
        inSpeciesList?: string[];
    };
}

interface Author {
    Name: string;
}

interface BhlResource {
    BHLType: string;
    FoundIn: string;
    Volume: string;
    Authors: Author[];
    PartUrl: string;
    ItemUrl: string;
    PartID: string;
    Genre: string;
    Title: string;
    ContainerTitle: string;
    Issue: string;
    Date: string;
    PublicationDate: string;
    PublisherName: string;
    PageRange: string;
    thumbnail: string;
}

function ResourcesView({result, isMobile}: MapViewProps) {
    const [bhl, setBhl] = useState<BhlResource[]>([]);
    const [bhlQuery, setBhlQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [onlineResources, setOnlineResources] = useState<Resource[]>([]);
    const maxBhlSize: number = 5;

    useEffect(() => {
        if (!result?.name || !result) {
            return;
        }

        let s = [result.name];

        // TODO: add .synonyms to the V2 API
        if (result?.synonyms) {
            result.synonyms.forEach((synonym: any) => s.push(synonym.nameString));
        }

        const searchQuery = encodeURIComponent('"' + s.join('" OR "') + '"');

        // Generate link for humans
        setBhlQuery(import.meta.env.VITE_APP_BHL_URL + `/search?SearchTerm=${searchQuery}&SearchCat=M#/names`);

        // Fetch pre-built BHL results from the static taxon-bhl directory, see taxon-bhl tool
        const guidEncoded = encodeURIComponent(encodeURIComponent(result.guid));
        const last2 = guidEncoded.substring(guidEncoded.length - 2);
        const bhlFileUrl = import.meta.env.VITE_TAXON_BHL_URL + '/' + last2 + '/' + guidEncoded + '.json';

        setLoading(true);
        setErrorMessage('');
        fetch(bhlFileUrl).then((response) => {
            if (!response.ok) {
                // No BHL data pre-built for this taxon — treat as empty
                setBhl([]);
                return null;
            }
            return response.json();
        }).then((data) => {
            if (Array.isArray(data)) {
                setBhl(data);
            }
        }).catch((error) => {
            setErrorMessage('Failed to fetch BHL data - ' + error);
        }).finally(() => {
            setLoading(false);
        });

        import('../../config/onlineResources.json')
            .then((module) => setOnlineResources(module.default)).catch((error) => console.error('Error loading resources:', error));
    }, [result]);

    function isResourceVisible(resource: Resource): boolean {
        var testsPassed = 0;
        var testsApplied = 0;

        for (const key in resource.rules) {
            if (key === 'inSpeciesGroup') {
                testsApplied++;

                for (const speciesGroup in result?.speciesGroup) {
                    if (resource.rules[key]?.includes(result?.speciesGroup[speciesGroup])) {
                        testsPassed++;
                        break;
                    }
                }
            }

            if (key === 'inSpeciesList') {
                testsApplied++;

                for (const speciesList in result?.speciesList) {
                    if (resource.rules[key]?.includes(result?.speciesList[speciesList])) {
                        testsPassed++;
                        break;
                    }
                }
            }
        }

        return testsApplied === testsPassed;
    }

    function formatAuthor(author: string): string {
        if (!author) {
            return '';
        }

        const parts = author.split(',');
        if (parts.length < 2 || parts[1].trim().length === 0) {
            return author;
        }

        return parts[0] + ', ' + parts[1].trim().charAt(0) + '.';
    }

    return <div>
        <span className={classes.speciesDescriptionTitle}>Literature</span>

        <span className={classes.h4grey}
              style={{marginBottom: isMobile ? '15px' : '30px', marginTop: isMobile ? '15px' : '30px'}}>
            Biodiversity Heritage Library (BHL)
        </span>

        {loading && (
            <div className={'placeholder-glow'}>
                <span
                    className="placeholder"
                    style={{
                        height: 24,
                        display: 'block',
                        width: isMobile ? '100%' : '500px',
                        borderRadius: '5px',
                    }}
                ></span>
                <span
                    className="placeholder"
                    style={{
                        height: 256,
                        display: 'block',
                        width: '100%',
                        borderRadius: '5px',
                        marginTop: '20px',
                    }}
                ></span>
            </div>
        )}
        {errorMessage && (
            <FlaggedAlert
                content={<>
                    <b>Error loading BHL results.</b>
                    <p>
                        Report this error by clicking on the{' '}
                        <b>Need Help?</b> button on the right edge of
                        the screen.
                    </p>
                    <code>{errorMessage}</code>
                </>}
            />
        )}
        {bhl && bhl.length > 0 && (<>
            <span style={{
                fontSize: isMobile ? '14px' : '16px',
                lineHeight: isMobile ? '20px' : '24px',
                fontWeight: 700
            }}>
                Showing {1} to{' '}
                {bhl.length > maxBhlSize ? maxBhlSize : bhl.length} for{' '}
                <FormatName name={result?.name} rankId={result?.rankID}/>.{' '}
                <a href={bhlQuery} target="bhl" className={classes.speciesLink}
                   style={{
                       fontSize: isMobile ? '14px' : '16px',
                       lineHeight: isMobile ? '20px' : '24px',
                       fontWeight: 700,
                   }}>
                    View in BHL
                </a>.
            </span>
            <table className="table table-striped align-middle" style={{
                marginTop: '20px',
                borderTop: '0.5px solid #212121',
                paddingTop: '10px',
                paddingBottom: '10px'
            }}>
                <tbody>
                {bhl.map((resource, index) => index < maxBhlSize && (
                    <tr key={index}>
                        <td style={{
                            border: '0px',
                            fontSize: isMobile ? '14px' : '16px',
                            lineHeight: isMobile ? '20px' : '24px'
                        }}>
                            {resource.Authors?.length === 1 ? (<>
                                {formatAuthor(resource.Authors[0].Name)}
                            </>) : (<>
                                {resource.Authors?.slice(0, -2).map((author) => formatAuthor(author.Name)).join(', ')}
                                {resource.Authors?.length > 1 && (<>
                                    {resource.Authors?.length > 2 && ', '}
                                    {resource.Authors?.slice(-2).map((author) => formatAuthor(author.Name)).join(' and ')}
                                </>)}
                            </>)}
                            {resource.Title && (resource.PartUrl || resource.ItemUrl) && (<>
                                {resource.Authors?.length > 0 && ', '}
                                <span style={{fontStyle: resource.ItemUrl ? 'italic' : undefined}}>
                                    <a href={resource.PartUrl || resource.ItemUrl} style={{
                                        color: '#003A70',
                                        textDecoration: 'underline'
                                    }}>'{resource.Title}'</a>
                                </span>
                            </>)}
                            {resource.ContainerTitle && (<>,{' '}<i>{resource.ContainerTitle}</i></>)}
                            {resource.PublisherName && (<>,{' '}{resource.PublisherName}</>)}
                            {resource.Volume && (<>,{' '}<span
                                style={{fontWeight: 'bold'}}>{resource.Volume}</span></>)}
                            {resource.Issue && (<>, {resource.Issue}{''}</>)}
                            {(resource.Date || resource.PublicationDate) && (<>,{' '}{resource.Date || resource.PublicationDate}</>)}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>)}
        {!loading && !errorMessage && (!bhl || bhl.length === 0) && (
            <span style={{fontSize: isMobile ? '14px' : '16px', lineHeight: isMobile ? '20px' : '24px'}}>
                No BHL references found for{' '}
                <FormatName name={result?.name} rankId={result?.rankID}/>
            </span>
        )}
        <hr className={classes.hrColour}
            style={{marginTop: isMobile ? '15px' : '30px', marginBottom: isMobile ? '15px' : '40px'}}/>

        <span className={classes.speciesDescriptionTitle}>Other resources</span>
        <div className="d-flex flex-wrap" style={{
            rowGap: isMobile ? 15 : 30,
            columnGap: isMobile ? 20 : 40,
            marginTop: isMobile ? '15px' : '30px'
        }}>
            {onlineResources.map((resource: Resource, idx) => isResourceVisible(resource) && (
                <a key={idx} className="btn ala-btn-primary ala-btn-large" href={resource.url}
                   style={{width: isMobile ? '100%' : ''}}>
                    {resource.name}
                </a>
            ))}
        </div>
        {isMobile && <div style={{height: '30px'}}/>}
    </div>;
}

export default ResourcesView;
