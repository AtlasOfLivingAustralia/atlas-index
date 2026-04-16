/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FlaggedAlert, InfoBox} from '@ala/common-ui';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import classes from './species.module.css';

import '../../css/nameFormatting.css';

interface ViewProps {
    result?: Record<PropertyKey, string | number | any>,
    isMobile: boolean
}

function ClassificationView({result, isMobile}: ViewProps) {
    const [children, setChildren] = useState<any[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (result?.guid) {
            const pageSize = 10000; // the maximum page size is 10000
            const fl = 'rank,nameFormatted,guid';
            fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/search?q=idxtype:TAXON&fq=-acceptedConceptID:*&fq=parentGuid:"' + encodeURIComponent(result.guid) + '"&fl=' + fl + '&pageSize=' + pageSize)
                .then((response) => response.json())
                .then((data) => {
                    if (data?.searchResults) {
                        // sort by the field that is displayed, note that nameFormatted might have issues since it is raw HTML
                        data.searchResults.sort((a: any, b: any) => a.nameFormatted < b.nameFormatted ? -1 : a.nameFormatted > b.nameFormatted ? 1 : 0);
                        setChildren(data.searchResults);
                    } else if (data?.status != 200 && data?.error) {
                        // Not sure why a 404 will end up here instead of the catch
                        setErrorMessage(data.error);
                    }
                }).catch((error) => {
                setErrorMessage(error);
            }).finally(() => {
                setLoading(false);
            });
        } else {
            setChildren([]);
        }

        if (result?.rankOrder) {
            let items: Record<PropertyKey, string | number | any>[] = [];
            for (let rank of result.rankOrder.split(',')) {
                var rankString = rank.replace(/[0-9]/g, ' '); // remove the suffix number that is used to handle duplicates
                items = [
                    {
                        rank: rankString,
                        name: result['rk_' + rank], // rkf_ for formatted name, rk_ for plain name
                        guid: result['rkid_' + rank],
                    },
                    ...items,
                ];
            }
            items.push({
                rank: result.rank,
                name: result.nameFormatted,
                guid: result.guid,
            });
            setHierarchy(items);
        } else {
            setHierarchy([]);
        }
    }, [result]);

    function capitalize(rank?: string) {
        // capitalize first letter
        return !rank ? '' : (rank.charAt(0).toUpperCase() + rank.slice(1));
    }

    return <div className="d-flex flex-column">
        {/* the choice made here is to display all of the hierarchy at once, rather than parents and children separately */}
        <InfoBox
            size={isMobile ? 14 : 16}
            icon={faCircleInfo}
            title="About classification"
            content={<>
                Classification of organisms allows us to group them and
                imply how they are related to each other. This includes
                a hierarchy of ranks e.g. kingdom, phylum etc. for more
                information see&nbsp;
                <a target="_blank" href={import.meta.env.VITE_TAXONOMY_INTRO_URL}
                   className={classes.speciesLink} style={{fontSize: isMobile ? '14px' : '16px'}}>
                    An introduction to taxonomy
                </a>.
            </>}
        />
        <div style={{height: isMobile ? '15px' : '30px'}}/>
        {loading && <div className={'placeholder-glow'}>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: '200px',
                      borderRadius: '5px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: '200px',
                      borderRadius: '5px',
                      marginLeft: '30px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: '200px',
                      borderRadius: '5px',
                      marginLeft: '60px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: '200px',
                      borderRadius: '5px',
                      marginLeft: '90px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '40px',
                      display: 'block',
                      width: isMobile ? '50%' : '400px',
                      borderRadius: '5px',
                      marginLeft: '120px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: isMobile ? '50%' : '400px',
                      borderRadius: '5px',
                      marginLeft: '150px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: isMobile ? '50%' : '400px',
                      borderRadius: '5px',
                      marginLeft: '150px',
                      marginTop: '10px',
                  }}></span>
            <span className="placeholder"
                  style={{
                      height: '20px',
                      display: 'block',
                      width: isMobile ? '50%' : '400px',
                      borderRadius: '5px',
                      marginLeft: '150px',
                      marginTop: '10px',
                  }}></span>
        </div>}
        <div className="d-flex flex-column gap-1 align-items-start"
             style={{width: '100%', marginLeft: isMobile ? '0px' : '-1rem'}}>
            {!loading && hierarchy.length === 0 && <>
                {/* For kingdom level items */}
                <div
                    className={`d-flex align-items-start ${classes.currentTaxa}`}
                    style={{borderRadius: '4px', marginBottom: '3px'}}>
                    <span className="fw-bold" style={{minWidth: 110, fontSize: isMobile ? '14px' : '16px'}}>
                        {capitalize(result?.rank)}
                    </span>
                    <Link to={`/species/${result?.guid}?tab=classification`}
                          dangerouslySetInnerHTML={{__html: result?.nameFormatted,}}
                          style={{paddingLeft: '15px', fontSize: isMobile ? '14px' : '16px'}}/>
                </div>
            </>}
            {!loading && hierarchy && hierarchy.map((item, idx) => (
                <div key={idx}
                     className={`d-flex align-items-start ${idx === hierarchy.length - 1 ? classes.currentTaxa : ''}`}
                     style={{
                         marginLeft: isMobile ? '0px' : idx * 20 + 'px',
                         borderRadius: '4px',
                         marginBottom: '3px',
                         display: 'block',
                     }}>
                    <span className="fw-bold"
                          style={{minWidth: 110, paddingLeft: '1rem', fontSize: isMobile ? '14px' : '16px'}}>
                        {capitalize(item.rank)}
                    </span>
                    <Link className={classes.speciesLink} to={`/species/${item?.guid}?tab=classification`}
                          dangerouslySetInnerHTML={{__html: item?.name}}
                          style={{paddingLeft: '15px', fontSize: isMobile ? '14px' : '16px'}}
                    />
                </div>
            ))}
            {children && children.map((child, idx) => (
                <div key={idx} className="d-flex align-items-start"
                     style={{marginLeft: isMobile ? '0px' : Math.max(1, hierarchy.length) * 20 + 1 + 'px',}}>
                    <span className="fw-bold"
                          style={{minWidth: 110, paddingLeft: '1rem', fontSize: isMobile ? '14px' : '16px'}}>
                        {capitalize(child.rank)}
                    </span>
                    <Link className={classes.speciesLink} to={`/species/${child.guid}?tab=classification`}
                          dangerouslySetInnerHTML={{__html: child.nameFormatted,}}
                          style={{paddingLeft: '15px', fontSize: isMobile ? '14px' : '16px'}}/>
                </div>
            ))}
        </div>
        {errorMessage && <FlaggedAlert
            content={<>
                <b>Error loading child taxa.</b>
                <p>
                    Report this error by clicking on the{' '}
                    <b>Need Help?</b> button on the right edge of
                    the screen.
                </p>
                <code>{errorMessage}</code>
            </>}
        />}
    </div>;
}

export default ClassificationView;
