/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useUser} from "@ala/common-ui";
import { useState } from 'react';
import Modal from 'react-bootstrap/esm/Modal';
import { FormattedMessage, useIntl } from 'react-intl';
import { RecordResult } from '../../api/model.tsx';
import { translate } from '../../util/util.tsx';

interface VerifyRecordModalProps {
    record: RecordResult;
    /** The user assertion being verified */
    assertion: any;
    onClose: () => void;
    /** Called after a successful verification so the parent can refresh assertions */
    onVerified?: () => void;
    /** Prefill values when editing an existing verification */
    prefill?: { status: string; comment: string; verificationUuid: string };
}

function VerifyRecordModal({ record, assertion, onClose, onVerified, prefill }: VerifyRecordModalProps) {
    const [status, setStatus] = useState<string>(prefill?.status ?? '50001');
    const [comment, setComment] = useState<string>(prefill?.comment ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const intl = useIntl();
    const {userInfo} = useUser();

    // Build the list of marked assertions, mirroring the GSP logic
    const markedParts: string[] = [];

    if (record?.processed?.geospatiallyKosher === false) {
        markedParts.push(intl.formatMessage({ id: 'show.verifyask.set01', defaultMessage: 'geospatially suspect' }));
    }
    if (record?.processed?.taxonomicallyKosher === false) {
        markedParts.push(intl.formatMessage({ id: 'show.verifyask.set02', defaultMessage: 'taxonomically suspect' }));
    }
    record?.systemAssertions?.warning?.forEach((sysAss: any) => {
        markedParts.push(translate(intl, sysAss.name, undefined));
    });
    const markedAssertions = markedParts.join(', ');

    function handleConfirm() {
        if (!comment) {
            alert(intl.formatMessage({ id: 'show.verifyrecord.comment.mandatory', defaultMessage: 'Please add a comment' }));
            return;
        }

        setSubmitting(true);

        const params = new URLSearchParams({
            recordUuid: record?.raw?.uuid || '',
            code: '50000',
            comment,
            userAssertionStatus: status,
            userId: userInfo?.userId || '',
            userDisplayName: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim(),
            ...(assertion?.uuid ? { assertionUuid: assertion.uuid } : {}),
            ...(prefill?.verificationUuid ? { updateId: prefill.verificationUuid } : {}),
        });

        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/assertions/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Bearer ' + userInfo?.accessToken,
            },
            body: params.toString(),
        })
            .then(r => {
                if (!r.ok) throw new Error('submit failed: ' + r.status);
                setSubmitting(false);
                setDone(true);
                onVerified?.();
            })
            .catch(err => {
                setSubmitting(false);
                alert(intl.formatMessage({ id: 'show.verifyrecord.error', defaultMessage: 'Error verifying record: ' }) + err.message);
            });
    }

    return (
        <Modal show onHide={onClose} size='lg' backdrop='static' keyboard={false}>
            <Modal.Header>
                <Modal.Title>
                    <FormattedMessage id='show.verifyrecord.title' defaultMessage='Confirmation' />
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {!done ? (
                    <div className='verifyAsk'>
                        <div>
                            <FormattedMessage id='show.verifyrecord.p01' defaultMessage='Record is marked with warnings' />:{' '}
                            <b>{markedAssertions || '—'}</b>
                        </div>
                        <div style={{ marginTop: '20px' }}
                             dangerouslySetInnerHTML={{ __html: intl.formatMessage({id:'show.verifyrecord.p02', defaultMessage:'Click the "Confirm" button to verify that this record is correct and that the listed "validation issues" are incorrect/invalid.'}) }}>
                        </div>
                        <div style={{ marginTop: '32px' }}>
                            <label htmlFor='userAssertionStatusSelection'>
                                <FormattedMessage id='show.verifyrecord.p03' defaultMessage='User Assertion Status:' />
                            </label>{' '}
                            <select name='userAssertionStatusSelection' id='userAssertionStatusSelection' value={status}
                                onChange={e => setStatus(e.target.value)}>
                                <option value='50001'>
                                    {intl.formatMessage({ id: 'user_assertions.50001', defaultMessage: 'Unresolved issue, recognised by data custodian' })}
                                </option>
                                <option value='50002'>
                                    {intl.formatMessage({ id: 'user_assertions.50002', defaultMessage: 'Record has been verified by data custodian as being correct' })}
                                </option>
                                <option value='50003'>
                                    {intl.formatMessage({ id: 'user_assertions.50003', defaultMessage: 'Corrected via data refresh' })}
                                </option>
                            </select>
                        </div>
                        <div style={{ marginTop: '32px' }}>
                            <textarea id='verifyComment' rows={3} style={{ width: '100%', boxSizing: 'border-box' }} value={comment}
                                onChange={e => setComment(e.target.value)}/>
                        </div>
                    </div>
                ) : (
                    <div className='verifyDone'>
                        <FormattedMessage id='show.verifydone.message' defaultMessage='Record successfully verified' />
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer>
                {!done ? (
                    <div className='verifyAsk d-flex align-items-center gap-2'>
                        <button className='btn btn-primary confirmVerify' onClick={handleConfirm} disabled={submitting}>
                            <FormattedMessage id='show.verifyrecord.btn.confirmverify' defaultMessage='Confirm' />
                        </button>
                        <button className='btn btn-outline-dark cancelVerify' onClick={onClose} disabled={submitting}>
                            <FormattedMessage id='show.verifyrecord.btn.cancel' defaultMessage='Cancel' />
                        </button>
                        {submitting && <i className='fa fa-spinner fa-spin' />}
                    </div>
                ) : (
                    <div className='verifyDone'>
                        <button className='btn btn-outline-dark closeVerify' onClick={onClose}>
                            <FormattedMessage id='show.verifydone.btn.closeverify' defaultMessage='Close' />
                        </button>
                    </div>
                )}
            </Modal.Footer>
        </Modal>
    );
}

export default VerifyRecordModal;

