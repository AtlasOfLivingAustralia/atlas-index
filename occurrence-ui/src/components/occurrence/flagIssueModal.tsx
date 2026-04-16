/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useUser} from "@ala/common-ui";
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/esm/Modal';
import { FormattedMessage, useIntl } from 'react-intl';
import { RecordResult } from '../../api/model.tsx';

interface AssertionCode {
    code: number;
    name: string;
}

interface FlagIssueModalProps {
    record: RecordResult;
    /** uuid of the assertion being edited, or null for a new assertion */
    editAssertionId?: string | null;
    /** pre-selected issue code when editing */
    editIssueCode?: number | null;
    /** pre-filled comment when editing */
    editComment?: string;
    onClose: () => void;
    /** called after a successful submit so parent can refresh assertions */
    onSubmitted?: () => void;
}

function FlagIssueModal({ record, editAssertionId, editIssueCode, editComment, onClose, onSubmitted }: FlagIssueModalProps) {

    const [assertionCodes, setAssertionCodes] = useState<AssertionCode[]>([]);
    const [selectedCode, setSelectedCode] = useState<string>('');
    const [comment, setComment] = useState<string>(editComment || '');
    const [relatedRecordId, setRelatedRecordId] = useState<string>('');
    const [relatedRecordReason, setRelatedRecordReason] = useState<string>('');
    const [notifyChange, setNotifyChange] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submitSuccess, setSubmitSuccess] = useState<string>('');
    const [relatedRecordState, setRelatedRecordState] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');
    const [relatedRecord, setRelatedRecord] = useState<any>(null);
    const relatedRecordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isDuplicate = selectedCode !== '' && assertionCodes.find(c => String(c.code) === selectedCode)?.name === 'userDuplicateRecord';
    const {userInfo} = useUser();
    const intl = useIntl();
    const isEditMode = !!editAssertionId;

    // Fetch available assertion codes on mount
    useEffect(() => {
        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/assertions/user/codes`)
            .then(r => r.json())
            .then((codes: AssertionCode[]) => {
                // filter to user-facing codes (< 50000)
                const userCodes = codes.filter((c: AssertionCode) => c.code < 50000);
                setAssertionCodes(userCodes);
                if (isEditMode && editIssueCode != null) {
                    setSelectedCode(String(editIssueCode));
                } else if (userCodes.length > 0) {
                    setSelectedCode(String(userCodes[0].code));
                }
            })
            .catch(() => {/* silently ignore */});
    }, []);

    // Look up related record when relatedRecordId changes (debounced)
    useEffect(() => {
        if (!relatedRecordId.trim()) {
            setRelatedRecordState('idle');
            setRelatedRecord(null);
            return;
        }
        setRelatedRecordState('loading');
        if (relatedRecordTimer.current) clearTimeout(relatedRecordTimer.current);
        relatedRecordTimer.current = setTimeout(() => {
            fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrence/${relatedRecordId.trim()}`)
                .then(r => {
                    if (!r.ok) throw new Error('not found');
                    return r.json();
                })
                .then(data => {
                    setRelatedRecord(data);
                    setRelatedRecordState('found');
                })
                .catch(() => {
                    setRelatedRecord(null);
                    setRelatedRecordState('notfound');
                });
        }, 500);
    }, [relatedRecordId]);

    function isValid() {
        // comment exists
        if (!comment.trim()) {
            return false;
        }

        // duplicate selected fields included
        if (isDuplicate && (!relatedRecord || !relatedRecordReason)) {
            return false;
        }

        return true;
    }

    const [submitError, setSubmitError] = useState<string>('');

    // ...existing code...

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!isValid()) {
            return;
        }

        const recordUuid = record?.raw?.uuid;
        const trimmedComment = comment.trim();

        setSubmitting(true);
        setSubmitError('');

        // Step 1: fetch existing assertions to guard against re-flagging an already-verified type
        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/${recordUuid}/assertions`)
            .then(r => r.json())
            .then((data: any[]) => {
                // Check: does a verified assertion (code=50000) already cover this issue code?
                const preventAdd = data.some(a => {
                    if (a.code === 50000) {
                        return data.some(inner => inner.uuid === a.relatedUuid && String(inner.code) === selectedCode && inner.uuid !== editAssertionId);
                    }
                    return false;
                });

                if (preventAdd) {
                    setSubmitError(intl.formatMessage({
                        id: 'show.issueform.flagfail.verified',
                        defaultMessage: 'You cannot flag an issue with the same type that has already been verified.'
                    }));
                    setSubmitting(false);
                    return;
                }

                // Step 2: duplicate-record specific validation (code 20020)
                if (selectedCode === '20020') {
                    if (!relatedRecordId) {
                        setSubmitError(intl.formatMessage({
                            id: 'show.issueform.duplicate.noid',
                            defaultMessage: 'You must provide a duplicate record id to mark this as a duplicate.'
                        }));
                        setSubmitting(false);
                        return;
                    }
                    if (!relatedRecordReason) {
                        setSubmitError(intl.formatMessage({
                            id: 'show.issueform.duplicate.noreason',
                            defaultMessage: 'You must select a reason to mark this record as a duplicate.'
                        }));
                        setSubmitting(false);
                        return;
                    }
                    if (relatedRecordId.trim() === recordUuid) {
                        setSubmitError(intl.formatMessage({
                            id: 'show.issueform.duplicate.self',
                            defaultMessage: "You can't mark a record as a duplicate of itself."
                        }));
                        setSubmitting(false);
                        return;
                    }
                }

                // Step 3: POST the assertion
                const params = new URLSearchParams({
                    recordUuid: recordUuid || '',
                    code: selectedCode,
                    comment: trimmedComment,
                    userAssertionStatus: 'Open issue',
                    userId: userInfo?.userId || '',
                    userDisplayName: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim(),
                    relatedRecordId: relatedRecordId,
                    relatedRecordReason: relatedRecordReason,
                    ...(editAssertionId ? { updateId: editAssertionId } : {})
                });

                fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/assertions/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Bearer ' + userInfo?.accessToken
                    },
                    body: params.toString()
                })
                    .then(r => {
                        if (!r.ok) throw new Error('submit failed');

                        // Step 4: update alert subscription if enabled
                        if (import.meta.env.VITE_ALERTS_MY_ANNOTATION_ENABLED === 'true') {
                            const alertMethod = notifyChange ? 'subscribeMyAnnotation' : 'unsubscribeMyAnnotation';
                            const alertsWsUrl = import.meta.env.VITE_APP_ALERTS_WS_URL;
                            const userId = userInfo?.userId || '';
                            fetch(`${alertsWsUrl}/api/alerts/user/${encodeURIComponent(userId)}/${alertMethod}`, {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + userInfo?.accessToken }
                            }).catch(() => { /* non-fatal */ });
                        }

                        setSubmitting(false);
                        setSubmitSuccess(intl.formatMessage({
                            id: 'show.issueform.flagsuccess.message',
                            defaultMessage: 'Thanks for flagging the problem!'
                        }));
                        onSubmitted?.();
                    })
                    .catch(() => {
                        setSubmitting(false);
                        setSubmitError(intl.formatMessage({
                            id: 'show.issueform.flagfail.message',
                            defaultMessage: 'There was a problem flagging the issue. Please try again later.'
                        }));
                    });
            })
            .catch(() => {
                setSubmitting(false);
                setSubmitError(intl.formatMessage({
                    id: 'show.issueform.flagfail.message',
                    defaultMessage: 'There was a problem flagging the issue. Please try again later.'
                }));
            });
    }

    return (
        <Modal show onHide={onClose} size='lg'>
            <Modal.Header closeButton>
                <Modal.Title>
                    {isEditMode ? <FormattedMessage id='show.loginorflag.title.edit' defaultMessage='Edit an issue' /> : <FormattedMessage id='show.loginorflag.title' defaultMessage='Flag an issue' />}
                    {import.meta.env.VITE_HELP_FLAG_ISSUE_URL && (
                        <a href={import.meta.env.VITE_HELP_FLAG_ISSUE_URL} target='_blank' rel='noreferrer' style={{ fontSize: '14px', marginLeft: '10px' }}>
                            <FontAwesomeIcon icon={faQuestionCircle} />
                        </a>
                    )}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {!userInfo?.authenticated ? (
                    /* Not logged in */
                    <div style={{ margin: '20px 0' }}>
                        <FormattedMessage id='show.loginorflag.div01.label' defaultMessage='Login please:' />{' '}
                        <a href={`${import.meta.env.VITE_LOGIN_URL || '/login'}?path=/occurrences/${record?.raw?.uuid}`}>
                            <FormattedMessage id='show.loginorflag.div01.navigator' defaultMessage='Click here' />
                        </a>
                    </div>
                ) : (
                    /* Logged in */
                    <div>
                        <FormattedMessage id='show.loginorflag.div02.label' defaultMessage='You are logged in as' />{' '}
                        <strong>
                            {userInfo.firstName} {userInfo.lastName} ({userInfo.email})
                        </strong>
                        <form id='issueForm' onSubmit={handleSubmit}>
                            <input type='hidden' name='assertionId' value={editAssertionId || ''} />
                            <input type='hidden' name='editMode' value={String(isEditMode)} />

                            {/* Issue type */}
                            <div style={{ marginTop: '20px' }}>
                                <label htmlFor='issue'>
                                    <FormattedMessage id='show.issueform.label01' defaultMessage='Issue type:' />
                                </label>{' '}
                                <select name='issue' id='issue' autoComplete='off' disabled={isEditMode} value={selectedCode} onChange={e => setSelectedCode(e.target.value)}>
                                    {assertionCodes.map(c => (
                                        <option key={c.code} value={String(c.code)}>
                                            {intl.formatMessage({ id: 'assertions.' + c.name, defaultMessage: c.name })}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Duplicate Record ID — only shown for userDuplicateRecord */}
                            {isDuplicate && <>
                                <div id='related-record-p' style={{ marginTop: '30px' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <label htmlFor='relatedRecordId' style={{ flexShrink: 0 }}>
                                            <FormattedMessage id='show.issueform.label03' defaultMessage='Duplicate Record ID:' />
                                            <span style={{ color: 'red' }}>*</span>
                                        </label>
                                        <input type='text' name='relatedRecordId' id='relatedRecordId' placeholder='Paste the duplicate record id here'
                                               style={{ flex: 1, minWidth: 0 }}
                                               value={relatedRecordId} onChange={e => setRelatedRecordId(e.target.value)} />
                                    </div>
                                    <div className='help-block'>
                                        {relatedRecordState === 'notfound' && <span style={{ color: 'red' }}>The record id can&apos;t be found.</span>}
                                        {relatedRecordState === 'loading' && (
                                            <span>
                                                <i className='fa fa-gear fa-spin' />
                                            </span>
                                        )}
                                        {relatedRecordState === 'found' && relatedRecord && (
                                            <div className={'mt-3'}>
                                                <span>
                                                    <FormattedMessage id='record.compare_table.heading' defaultMessage='You are indicating that' />:
                                                </span>
                                                <table className='table table-bordered table-condensed table-striped' style={{ marginTop: '8px' }}>
                                                    <tbody>
                                                        <tr>
                                                            <td style={{ width: '35%' }}>
                                                                <strong><FormattedMessage id='record.compare_table.source_record.heading' defaultMessage='This record' /></strong>
                                                            </td>
                                                            <td id='col_duplicate_reason' rowSpan={6}>
                                                                {relatedRecordReason &&
                                                                    <strong><FormattedMessage id={'related.record.reason.description.' + relatedRecordReason} defaultMessage={relatedRecordReason} /></strong>
                                                                }
                                                            </td>
                                                            <td style={{ width: '35%' }}>
                                                                <strong><FormattedMessage id='record.compare_table.target_record.heading' defaultMessage='This record ID provided' /></strong>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>{record?.processed?.classification?.scientificName || record?.raw?.classification?.scientificName || ''}</td>
                                                            <td>{relatedRecord?.processed?.classification?.scientificName || relatedRecord?.raw?.classification?.scientificName || ''}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>{record?.processed?.location?.stateProvince || record?.raw?.location?.stateProvince || ''}</td>
                                                            <td>{relatedRecord?.processed?.location?.stateProvince || relatedRecord?.raw?.location?.stateProvince || ''}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>{record?.processed?.location?.decimalLongitude || record?.raw?.location?.decimalLongitude || ''}</td>
                                                            <td>{relatedRecord?.processed?.location?.decimalLongitude || relatedRecord?.raw?.location?.decimalLongitude || ''}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>{record?.processed?.location?.decimalLatitude || record?.raw?.location?.decimalLatitude || ''}</td>
                                                            <td>{relatedRecord?.processed?.location?.decimalLatitude || relatedRecord?.raw?.location?.decimalLatitude || ''}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>{record?.processed?.event?.eventDate || record?.raw?.event?.eventDate || ''}</td>
                                                            <td>{relatedRecord?.processed?.event?.eventDate || relatedRecord?.raw?.event?.eventDate || ''}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div id='related-record-reason-p' style={{ marginTop: '30px' }}>
                                    <label htmlFor='relatedRecordReason' style={{ verticalAlign: 'top' }}>
                                        <FormattedMessage id='show.issueform.label04' defaultMessage='Duplicate Reason:' />
                                        <span style={{ color: 'red' }}>*</span>
                                    </label>{' '}
                                    <select name='relatedRecordReason' id='relatedRecordReason' autoComplete='off' value={relatedRecordReason} onChange={e => setRelatedRecordReason(e.target.value)}>
                                        <option value=''>
                                            <FormattedMessage id='related.record.reason.select' defaultMessage='-- Select a reason --' />
                                        </option>
                                        <option value='sameoccurrence'>
                                            <FormattedMessage id='related.record.reason.sameoccurrence' defaultMessage='Duplicate occurrence' />
                                        </option>
                                        <option value='tissuesample'>
                                            <FormattedMessage id='related.record.reason.tissuesample' defaultMessage='Tissue sample' />
                                        </option>
                                        <option value='splitspecimen'>
                                            <FormattedMessage id='related.record.reason.splitspecimen' defaultMessage='Split specimen' />
                                        </option>
                                    </select>
                                </div>
                            </>}

                            {/* Comment */}
                            <div style={{ marginTop: '30px' }}>
                                <label htmlFor='issueComment' style={{ verticalAlign: 'top' }}>
                                    <FormattedMessage id='show.issueform.label02' defaultMessage='Comment:' />
                                    <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    name='comment'
                                    id='issueComment'
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        height: '150px'
                                    }}
                                    placeholder={intl.formatMessage({ id: 'show.issueform.label02', defaultMessage: 'Please add a comment here...' })}
                                    value={comment}
                                    onChange={e => {setComment(e.target.value);}}
                                />
                            </div>

                            {/* Notify me checkbox — shown when VITE_ALERTS_MY_ANNOTATION_ENABLED is true */}
                            {import.meta.env.VITE_ALERTS_MY_ANNOTATION_ENABLED === 'true' && (
                                <div style={{ marginTop: '30px' }}>
                                    <label style={{ width: '100%' }}>
                                        <input type='checkbox' name='notifyChange' id='notifyChangeCheckbox' checked={notifyChange} onChange={e => setNotifyChange(e.target.checked)} />{' '}
                                        <FormattedMessage id='show.issueform.notifyme' defaultMessage='Notify me when records I have annotated are updated' />
                                    </label>
                                </div>
                            )}

                            {/* Buttons */}
                            <div style={{ marginTop: '20px' }}>
                                {!submitSuccess && <input id='issueFormSubmit' type='submit' value={intl.formatMessage({ id: 'show.issueform.button.submit', defaultMessage: 'Submit' })} className='btn btn-primary' disabled={submitting || !isValid()} />}{' '}
                                {!submitSuccess && <input type='button' id='cancel' value={intl.formatMessage({ id: 'show.issueform.button.cancel', defaultMessage: 'Cancel' })} className='btn btn-outline-dark' onClick={onClose} />}
                                {submitSuccess && <input type='button' id='close' value={intl.formatMessage({ id: 'show.issueform.button.close', defaultMessage: 'Close' })} className='btn btn-outline-dark' onClick={onClose} />}
                                <span id='submitSuccess' style={{ marginLeft: '10px' }}>{submitSuccess}</span>
                            </div>

                            {submitError && (
                                <div style={{ marginTop: '10px', color: 'red' }}>
                                    {submitError}
                                </div>
                            )}

                            {submitting && (
                                <div id='assertionSubmitProgress'>
                                    <i className='fa fa-spinner fa-spin' />
                                </div>
                            )}
                        </form>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
}

export default FlagIssueModal;

