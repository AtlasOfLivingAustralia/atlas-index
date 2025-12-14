/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { faFileCode } from '@fortawesome/free-regular-svg-icons';
import React, {useEffect, useRef, useState} from "react";

import { Breadcrumb, FontAwesomeIconLite, useUser } from '@ala/common-ui';
import { Overlay, Popover } from 'react-bootstrap';
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {RecordResult} from "../api/model.tsx";
import DataQualityOccurrence from "../components/occurrence/dataQualityOccurrence.tsx";
import Duplication from "../components/occurrence/duplication.tsx";
import EnvironmentSampleInfo from '../components/occurrence/environmentalSampleInfo.tsx';
import OccurrenceAssertions from "../components/occurrence/occurrenceAssertions.tsx";
import OriginalVsProcessed from '../components/occurrence/originalVsProcessed.tsx';
import OutlierFeedback from "../components/occurrence/outlierFeedback.tsx";
import RecordCore from "../components/occurrence/recordCore.tsx";
import RecordSidebar from '../components/occurrence/recordSidebar.tsx';
import ReferencedPublications from "../components/occurrence/referencedPublications.tsx";
import './occurrence.css';

// TODO: move to external config files
const vernacularName_show = true;

function Occurrence({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}) {
    const {uuid} = useParams();
    const [record, setRecord] = useState<RecordResult | undefined>(undefined);

    // various other information for display
    const [collectionInfo, setCollectionInfo] = useState<any>(null);
    const [contacts, setContacts] = useState<any>(null);
    const [userAssertions, setUserAssertions] = useState<any>(null);
    const [compareRecord, setCompareRecord] = useState<any>(null);

    const location = useLocation();
    const [recordsViewProps, setRecordsViewProps] = useState<any>(location.state?.recordsViewProps || {});
    const [currentPageIds, setCurrentPageIds] = useState<string[]>([]);
    const [currentOccurrenceIndex, setCurrentOccurrenceIndex] = useState<number | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);

    const [eventHierarchy, setEventHierarchy] = useState<any>(null);

    // modals state
    const [showCopyLinkModal, setShowCopyLinkModal] = useState(false);
    const [showOriginalVsProcessed, setShowOriginalVsProcessed] = useState(false);

    const {userInfo} = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
            {title: 'Occurrence', href: '/occurrence'},
        ]);

        fetchOccurrence();
    }, []);

    // updates when occurrence index changes, e.g. next/previous occurrence
    useEffect(() => {
        if (currentOccurrenceIndex) {
            fetchOccurrence();
        }
    }, [currentOccurrenceIndex]);

    useEffect(() => {
        if (!recordsViewProps || Object.keys(recordsViewProps).length === 0) {
            return;
        }

        fetchPageIds();
    }, [recordsViewProps]);

    const fetchPageIds = async () => {
        const indexJson = await fetch(
            import.meta.env.VITE_APP_BIOCACHE_URL +
            '/occurrences/search' +
            recordsViewProps.queryString +
            "&pageSize=" + recordsViewProps.pageSize +
            "&sort=" + recordsViewProps.sort +
            "&dir=" + recordsViewProps.dir +
            "&start=" + (recordsViewProps.page - 1) * recordsViewProps.pageSize +
            "&fl=id",
            {method: 'GET'}
        ).then(response => response.json());

        setTotalRecords(indexJson);

        let ids = indexJson.occurrences.map((occurrence: any) => occurrence.uuid);
        setCurrentPageIds(ids);

        // update occurrence and/or occurrence index
        const currentIndex = ids.indexOf(uuid || '');
        if (currentOccurrenceIndex == null) {
            // first time
            setCurrentOccurrenceIndex(currentIndex);
        } else {
            // paging; index was updated for the new page already
            fetchOccurrence();
        }
    };

    function isLastRecord(): boolean {
        return (recordsViewProps.page * recordsViewProps.pageSize) >= totalRecords
            && (currentOccurrenceIndex == null || currentOccurrenceIndex < (currentPageIds.length - 1));
    }

    const nextOccurrence = () => {
        if (!recordsViewProps || currentOccurrenceIndex == null) {
            return null;
        }

        if (isLastRecord()) {
            return null;
        }

        // if last on this page, reset and fetch next page
        if (currentOccurrenceIndex === currentPageIds.length - 1) {
            setCurrentOccurrenceIndex(0);
            setRecordsViewProps((prevProps: any) => ({
                ...prevProps,
                page: prevProps.page + 1
            }));
            return null;
        } else {
            setCurrentOccurrenceIndex(currentOccurrenceIndex + 1);
            fetchOccurrence(currentPageIds[currentOccurrenceIndex + 1]);
        }
    }

    function isFirstRecord(): boolean {
        return recordsViewProps.page === 1 && currentOccurrenceIndex === 0;
    }

    const prevOccurrenceIndex = () => {
        if (!recordsViewProps || currentOccurrenceIndex == null) {
            return null;
        }

        if (isFirstRecord()) {
            return null;
        }

        // if first on this page, reset and fetch next page
        if (currentOccurrenceIndex === 0) {
            setCurrentOccurrenceIndex(currentPageIds.length - 1);
            setRecordsViewProps((prevProps: any) => ({
                ...prevProps,
                page: prevProps.page - 1
            }));
            return null;
        } else {
            setCurrentOccurrenceIndex(currentOccurrenceIndex - 1);
            fetchOccurrence(currentPageIds[currentOccurrenceIndex - 1]);
        }
    }

    // will use the newUuid if provided (for next/previous), otherwise
    // will use the currentPageIds[currentOccurrenceIndex] if available, otherwise
    // will use the uuid from params
    const fetchOccurrence = async (newUuid?: string) => {
        if (!uuid) {
            return;
        }

        const pagedUuid = (currentPageIds && currentOccurrenceIndex != null &&
            currentOccurrenceIndex < currentPageIds.length) ? currentPageIds[currentOccurrenceIndex] : null;

        const fetchUuid = newUuid || pagedUuid || uuid;

        if (uuid != fetchUuid) {
            window.history.replaceState(recordsViewProps, '', '/occurrence/' + fetchUuid);
        }

        try {
            const indexJson = await fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/' + fetchUuid + "?im=true", {
                method: 'GET'
            });
            if (!indexJson.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await indexJson.json();
            setRecord(data);

            // extra information for display
            if (data?.processed?.attribution?.collectionUid) {
                fetchCollectionInfo(data?.processed?.attribution?.collectionUid);
            } else if (data?.raw?.attribution?.dataResourceUid) {
                fetchDataResourceInfo(data?.raw?.attribution?.dataResourceUid);
            }
            getUserAssertions(fetchUuid);

            getCompareRecordInfo(fetchUuid);
        } catch (error) {
            // TODO: 404 or other error to display
            console.error(error);
            setRecord(undefined);
        }
    }

    function getCompareRecordInfo(fetchUuid: string) {
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/compare/' + fetchUuid, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => response.json()).then(data => {
            setCompareRecord(data);
        })
    }

    // $.get( OCC_REC.contextPath + "/assertions/" + OCC_REC.recordUuid, function(data) {
    const getUserAssertions = async (uuid: string) => {
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrences/' + uuid + '/assertions', {
            method: 'GET'
        }).then(response => response.json())
            .then(userAssertions => {
                lookup20020Assertions(userAssertions);
            }).catch(error => {
            console.error('Error fetching collection info:', error);
        });
    }

    async function lookup20020Assertions(userAssertions: any) {
        const assertions20020 = userAssertions.filter((assertion: any) => assertion.code === 20020);

        for (let i = 0; i < assertions20020.length; i++) {
            const assertion = assertions20020[i];
            if (assertion.relatedRecordId) {
                try {
                    const indexJson = await fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrence/exists/' + assertion.relatedRecordId, {
                        method: 'GET'
                    });
                    if (!indexJson.ok) {
                        throw new Error('Network response was not ok');
                    }
                    const relatedRecordData = await indexJson.json();

                    assertion.relatedRecord = {
                        scientificName: relatedRecordData.scientificName,
                        stateProvince: relatedRecordData.stateProvince,
                        decimalLatitude: relatedRecordData.decimalLatitude,
                        decimalLongitude: relatedRecordData.decimalLongitude,
                        eventDate: relatedRecordData.eventDate
                    };
                } catch (error) {
                    // skip errors
                }
            }
        }

        // verified assertions have code = 50000
        const verified = userAssertions.filter((assertion: any) => assertion.code === 50000)
            .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());

        // disableDelete are those with relatedUuid < 0
        const disableDelete = verified.filter((assertion: any) => assertion.relatedUuid < 0).map((item: any) => item.relatedUuid);

        // insert verified and disableDelete into data
        for (let i = 0; i < userAssertions.length; i++) {
            if (userAssertions[i].code !== 50000) {
                if (disableDelete.includes(userAssertions[i].uuid)) {
                    userAssertions[i].disableDelete = true;
                }
                userAssertions[i].verified = [];
                for (let j = 0; j < verified.length; j++) {
                    if (userAssertions[i].uuid === verified[j].relatedUuid) {
                        userAssertions[i].verified.push(verified[j]);
                    }
                }
            }
        }

        setUserAssertions(userAssertions);

    }

    function fetchCollectionInfo(collectionUid: string) {
        // collectory info
        fetch(import.meta.env.VITE_APP_COLLECTORY_URL + '/lookup/summary/' + collectionUid, {
            method: 'GET'
        }).then(response => response.json())
            .then(data => {
                setCollectionInfo({
                    collectionName: data?.name,
                    collectionLogo: data?.institutionLogoUrl,
                    collectionInstitution: data?.institution
                });
            }).catch(error => {
            console.error('Error fetching collection info:', error);
        });

        // contact info
        fetch(import.meta.env.VITE_APP_COLLECTORY_URL + '/ws/collection/' + collectionUid + '/contact.json', {
            method: 'GET'
        }).then(response => response.json())
            .then(data => {
                setContacts(data);
            }).catch(error => {
            console.error('Error fetching collection info:', error);
        });
    }

    function fetchDataResourceInfo(dataResourceUid: string) {
        // contact info
        fetch(import.meta.env.VITE_APP_COLLECTORY_URL + '/ws/dataResource/' + dataResourceUid + '/contact.json', {
            method: 'GET'
        }).then(response => response.json())
            .then(data => {
                setContacts(data);
            }).catch(error => {
            console.error('Error fetching collection info:', error);
        });
    }

    function backToSearch() {
        // replace the URL with recordsViewProps
        navigate('/occurrences/search' + recordsViewProps.queryString +
            "&page=" + recordsViewProps.page +
            "&pageSize=" + recordsViewProps.pageSize +
            "&sort=" + recordsViewProps.sort +
            "&dir=" + recordsViewProps.dir);
    }

    function isCollectionAdmin(): boolean {
        if (userInfo?.roles?.includes(import.meta.env.VITE_APP_ROLE_ADMIN)) {
            return true;
        }

        if (!contacts || !userInfo?.email) {
            return false;
        }

        for (let i = 0; i < contacts.length; i++) {
            if (contacts[i].editor === true && userInfo.email.toLowerCase() === contacts[i].contact.email.toLowerCase()) {
                return true;
            }
        }

        return false;
    }

    function recordId(): string {
        var id = record?.raw?.uuid || '';

        if (record?.raw?.occurrence?.collectionCode && record?.raw?.occurrence?.catalogNumber) {
            id = record?.raw?.occurrence?.collectionCode + ":" + record?.raw?.occurrence?.catalogNumber
        } else if (record?.processed?.attribution?.dataResourceName && record?.raw?.occurrence?.catalogNumber) {
            id = record?.processed?.attribution?.dataResourceName + " - " + record?.raw?.occurrence?.catalogNumber
        } else if (record?.raw?.occurrence?.occurrenceID) {
            id = record?.raw?.occurrence?.occurrenceID
        }

        return id;
    }

    function CopyTooltip({text, children}: { text: string, children: React.ReactNode }) {
        const [show, setShow] = useState(false);
        const target = useRef(null);

        return (
            <>
                <span ref={target} style={{ cursor: 'pointer' }} onClick={() => {
                    setShow(true);
                    setTimeout(() => {setShow(false);}, 3000);
                }}>
                    {children}
                </span>
                <Overlay target={target.current} show={show} placement='top'>
                    {props => (
                        <Popover {...props} style={{ ...props.style }}>
                            <Popover.Body>
                                <div>{text}</div>
                            </Popover.Body>
                        </Popover>
                    )}
                </Overlay>
            </>
        );
    }

    function isUrl(value: string | undefined): boolean {
        if (!value || !value.startsWith('http://') || !value.startsWith('https://')) {
            return false;
        }
        try {
            new URL(value);
            return true;
        } catch (_) {
            return false;
        }
    }

    if (!record) {
        return null;
    }

    return (
        <div className={'container-fluid'} id={'main'}>
        <div className={'container-fluid'} id={'main-content'}>
            {/*record.raw*/}
            {/*heading bar*/}
            <div className='recordHeader clearfix' id='headingBar'>
                <div className='side left'>
                    {collectionInfo?.collectionLogo && (
                        <div className='sidebar'>
                            <img src={collectionInfo?.collectionLogo} alt='institution logo' id='institutionLogo' />
                        </div>
                    )}
                </div>
                <div className='side right'>
                    <div id='jsonLinkZ'>
                        {isCollectionAdmin() && <span> - admin</span>}
                        {userInfo?.roles?.includes(import.meta.env.VITE_APP_ROLE_ADMIN) && (
                            <div id='clubView'>
                                <span className='label label-danger'>
                                    <i className='glyphicon glyphicon-lock'></i> Club View
                                </span>
                            </div>
                        )}
                    </div>
                    <div className='pull-rightZ'>
                        {recordsViewProps && Object.keys(recordsViewProps).length > 0 && (
                            <>
                                <span id='previousBtn'>
                                    <a
                                        href='#'
                                        title='Previous record'
                                        className={`btn btn-default${isFirstRecord() ? ' disabled' : ''}`}
                                        onClick={() => {
                                            prevOccurrenceIndex();
                                        }}>
                                        <span>
                                            <i className='glyphicon glyphicon-arrow-left' style={{ marginBottom: 5 }}></i> Previous
                                        </span>
                                    </a>
                                </span>
                                <span id='nextBtn'>
                                    <a
                                        href='#'
                                        title='Next record'
                                        className={`btn btn-default${isLastRecord() ? ' disabled' : ''}`}
                                        onClick={() => {
                                            nextOccurrence();
                                        }}>
                                        <span>
                                            <i className='glyphicon glyphicon-arrow-right' style={{ marginBottom: 5 }}></i> Next
                                        </span>
                                    </a>
                                </span>
                                <span id='backBtn'>
                                    <a
                                        href='#'
                                        title='Back to search results'
                                        className='btn btn-default'
                                        onClick={() => {
                                            backToSearch();
                                        }}>
                                        Back to search results
                                    </a>
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className='centre'>
                    <h1>Occurrence record: <span id='recordId'>{recordId()}</span></h1>
                    {record?.raw?.classification && (
                        <div id='recordHeadingLine2'>
                            <span>{record?.processed?.occurrence?.basisOfRecord || ''}</span>
                            <span> of </span>
                            {record?.processed?.classification?.scientificName ? (
                                <>
                                    <i>{record.processed.classification.scientificName}</i> {record.processed.classification.scientificNameAuthorship}
                                </>
                            ) : record?.raw?.classification?.scientificName ? (
                                <>
                                    <i>{record.raw.classification.scientificName}</i> {record.raw.classification.scientificNameAuthorship}
                                </>
                            ) : (
                                <>
                                    <i>{record.raw.classification.genus} {record.raw.classification.specificEpithet}</i> {record.raw.classification.scientificNameAuthorship}
                                </>
                            )}
                            {vernacularName_show && record?.processed?.classification?.vernacularName && <> | {record.processed.classification.vernacularName}</>}
                            {vernacularName_show && record?.raw?.classification?.vernacularName && <> | {record.raw.classification.vernacularName}</>}
                            {(record?.processed?.event?.eventDate || record?.raw?.event?.eventDate) && (
                                <><span> recorded on </span>{record.processed.event?.eventDate || record.raw.event?.eventDate}</>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className='row'>
                <div id='record-sidebar' className='col-md-4 scrollspy'>
                    <RecordSidebar record={record} contacts={contacts} userAssertions={userAssertions} eventHierarchy={eventHierarchy}/>
                </div>
                <div className='col-md-8'>
                    <div className='text-end'>
                        {isUrl(record?.raw?.occurrence?.occurrenceID) && (
                            <a href={record?.raw?.occurrence?.occurrenceID || '#'} className='btn btn-default' title='Click to view the original record'>
                                View original record
                            </a>
                        )}
                        <button className='btn btn-default' id='showRawProcessed' title='Table showing both original and processed record values' onClick={() => setShowOriginalVsProcessed(true)}>
                            <span id='processedVsRawViewSpan' title=''>
                                <i className='glyphicon glyphicon-transfer'></i>
                                View original vs processed values
                            </span>
                        </button>
                        <input id='hidden-uuid' type='hidden' value={uuid} />
                        <CopyTooltip text={`${uuid} copied!`}>
                            <button
                                className='btn btn-default'
                                id='copyRecordIdToClipboard'
                                title="Copy this record's id to the clipboard"
                                onClick={() => {
                                    navigator.clipboard.writeText(uuid || '');
                                }}>
                                Copy record id
                            </button>
                        </CopyTooltip>
                        <a href='#CopyLink' className='tooltips btn btn-default copyLink' onClick={() => setShowCopyLinkModal(true)}>
                            <FontAwesomeIconLite icon={faFileCode} />
                            &nbsp;&nbsp;API
                        </a>
                        {showCopyLinkModal && (
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
                                onClick={() => setShowCopyLinkModal(false)}>
                                <div
                                    className='modal-content'
                                    style={{
                                        position: 'relative',
                                        background: '#fff',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        width: '500px',
                                        height: '200px',
                                        overflowY: 'auto'
                                    }}
                                    onClick={e => e.stopPropagation()}>
                                    <div className={'modal-header'}>
                                        <h3>JSON web service API</h3>
                                        <button className='btn btn-link' style={{ fontSize: '24px', color: '#212121', textDecoration: 'none', zIndex: 2 }} aria-label='Close' onClick={() => setShowCopyLinkModal(false)}>
                                            &times;
                                        </button>
                                    </div>
                                    <div className={'modal-body'}>
                                        <div className='col-sm-12 input-group'>
                                            <input type='text' className='form-control' value={`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/${uuid}`} id='al4rcode' readOnly />
                                            <CopyTooltip text={'copied!'}>
                                                <button className='form-control btn btn-default tooltips input-group-btn' title='Copy to clipboard' onClick={() => navigator.clipboard.writeText(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/${uuid}`)}>
                                                    Copy URL
                                                </button>
                                            </CopyTooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <RecordCore record={record} compareRecord={compareRecord} collectionInfo={collectionInfo} setEventHierarchy={setEventHierarchy}/>

                    <OccurrenceAssertions userAssertions={userAssertions} record={record} isCollectionAdmin={isCollectionAdmin} />

                    <ReferencedPublications record={record} />

                    <DataQualityOccurrence record={record} />

                    <OutlierFeedback record={record} />

                    <Duplication record={record} />

                    <EnvironmentSampleInfo record={record} />
                </div>
            </div>

            {showOriginalVsProcessed && (
                <OriginalVsProcessed
                    compareRecord={compareRecord}
                    onClose={() => {
                        setShowOriginalVsProcessed(false);
                    }}
                />
            )}

            {/*!record.raw 404*/}
            {record && !record.raw && (
                <div id='headingBar' className={'mt-5'}>
                    <h1>Record Not Found</h1>
                    <p>The requested record ID "{uuid}" was not found</p>
                </div>
            )}

            {/*contacts modal*/}

            {/*userAnnotationTemplate dialog*/}

            {/*userVerificationTemplate dialog*/}

            {/*verifyRecordModal dialog*/}
        </div>
        </div>
    );
}

export default Occurrence;
