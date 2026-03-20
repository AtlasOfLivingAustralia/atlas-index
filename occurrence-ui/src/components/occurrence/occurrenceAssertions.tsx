/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {RecordResult} from "../../api/model.tsx";
import {translate} from "../../util/util.tsx";

function OccurrenceAssertions({userAssertions, record, isCollectionAdmin}: {
    userAssertions: any[],
    record: RecordResult,
    isCollectionAdmin: () => boolean
}) {

    const intl: IntlShape = useIntl();

    // TODO: finish this component
    return <>
        {userAssertions && userAssertions.length > 0 &&
            <div id="userAnnotationsDiv" className="additionalData">
                <h3><FormattedMessage id="show.userannotationsdiv.title" defaultMessage="User flagged issues"/><a id="userAnnotations">&nbsp;</a></h3>
                <ul style={{ paddingLeft: '0'}}>
                    {/* assertionQueries section is deprecated */}

                    {userAssertions.filter((assertion: any) => assertion.code != 50000)
                        .map(((assertion: any, index: number) =>
                                <li className="userAnnotationTemplate well well-sm" key={index}>
                                    <h4 style={{marginTop: '10px'}}>
                                        <span className="issue i8nupdate">{translate(intl, assertion.name, 'assertions')}</span> -
                                        <FormattedMessage id="show.userannotationtemplate.title" defaultMessage="flagged by"/>{" "}
                                        <span className="user">{assertion.userDisplayName}</span>
                                        <span className="userRole">{assertion.userRole}</span>
                                        <span className="userEntity">{assertion.userEntityName}</span>
                                    </h4>
                                    {assertion.relatedRecordReason &&
                                        <p className="related-record-reason"><FormattedMessage id="show.userannotationtemplate.relatedrecord.reason.label" defaultMessage="Reason:"/>&nbsp;
                                            <span className="related-record-reason-span i8nupdate">
                                                {translate(intl, assertion.relatedRecordReason, 'assertions')}</span>
                                        </p>}
                                    {assertion.relatedRecordId &&
                                        <p className="related-record">
                                            {assertion.relatedRecordReason && (
                                                <p className="related-record-reason-explanation i8nupdate">
                                                    {translate(intl, assertion.relatedRecordReason, 'assertions')}
                                                </p>
                                            )}

                                            <p className="related-record-id">
                                                &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.id.label" defaultMessage="record ID"/>&nbsp;<span
                                                className="related-record-id-span">{assertion.relatedRecordId}</span>
                                            </p>

                                            {assertion?.relatedRecord?.scientificName && (
                                                <p className="related-record-name">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.name.label" defaultMessage="scientific name"/>: <span
                                                    className="related-record-name-span">{assertion.relatedRecord.scientificName}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.stateProvince && (
                                                <p className="related-record-state">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.state.label" defaultMessage="state"/>: <span
                                                    className="related-record-state-span">{assertion.relatedRecord.stateProvince}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.decimalLatitude && (
                                                <p className="related-record-latitude">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.latitude.label" defaultMessage="latitude"/>: <span
                                                    className="related-record-latitude-span">{assertion.relatedRecord.decimalLatitude}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.decimalLongitude && (
                                                <p className="related-record-longitude">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.longitude.label" defaultMessage="longitude"/>: <span
                                                    className="related-record-longitude-span">{assertion.relatedRecord.decimalLongitude}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.eventDate && (
                                                <p className="related-record-eventdate">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;<FormattedMessage id="related.record.eventdate.label" defaultMessage="eventDate"/>: <span
                                                    className="related-record-eventdate-span">{assertion.relatedRecord.eventDate}</span>
                                                </p>
                                            )}
                                            <a className="related-record-link"
                                               href={`/occurrence/${assertion.relatedRecordId}`}
                                               target="_blank">
                                                {assertion.code === 20020 ?
                                                    <span className="related-record-span-user-duplicate">
                                                        <FormattedMessage id="show.userannotationtemplate.relatedrecord.userduplicate.a" defaultMessage="View duplicated record"/>
                                                    </span> :
                                                    <span className="related-record-span-default">
                                                        <FormattedMessage id="show.userannotationtemplate.relatedrecord.default.a" defaultMessage="View related record"/>
                                                    </span>
                                                }
                                            </a>
                                        </p>}
                                    {assertion.comment && <p className="comment">Comment: {assertion.comment}</p>}
                                    {/*<p className="hide issueCode">{assertion.issueCode}</p>*/}
                                    {/*<p className="hide issueComment">{assertion.comment (duplicate)}</p>*/}
                                    {/*<p className="hide userDisplayName">{assertion.userDisplayName}</p>*/}
                                    <p className="created small">Date created: {new Date(assertion.created).toLocaleString('en-CA', {hour12: false}).replace(',', '')}</p>
                                    {/*query_assertion_uuid is deprecated*/}
                                    {assertion.userId === record.userId &&
                                        <p className="deleteAnnotation">
                                            <a className="editAnnotationButton btn btn-danger" href="#"
                                               onClick={() => alert('TODO')}>
                                                <FormattedMessage id="show.userannotationtemplate.p05.navigator" defaultMessage="Edit"/>
                                                {/* TODO: progress indicator */}
                                                {/*<span className="editAssertionSubmitProgress" style={{display: "none"}}>*/}
                                                {/*    <img src="/indicator.gif" alt="indicator icon"/>*/}
                                                {/*</span>*/}
                                            </a>
                                            <a className="deleteAnnotationButton btn btn-danger" href="#"
                                               onClick={() => alert('TODO')}>
                                                <FormattedMessage id="show.userannotationtemplate.p02.navigator" defaultMessage="Delete this annotation"/>
                                                {/* TODO: progress indicator */}
                                                {/*<span className="deleteAssertionSubmitProgress" style={{display: "none"}}>*/}
                                                {/*    <img src="/indicator.gif" alt="indicator icon"/>*/}
                                                {/*</span>*/}
                                            </a>
                                        </p>
                                    }
                                    {isCollectionAdmin() && (
                                        <p className="verifyAnnotation">
                                            <a className="verifyAnnotationButton btn btn-default" href="#verifyRecordModal" onClick={() => alert('TODO')}>
                                                <i className="glyphicon glyphicon-thumbs-up"></i> &nbsp;
                                                <FormattedMessage id="show.userannotationtemplate.p03.navigator" defaultMessage="Verify this annotation"/>
                                            </a>
                                        </p>
                                    )}
                                    {assertion.verified &&
                                        <table className="table verifications">
                                            <thead>
                                            <tr>
                                                <th>Verification status</th>
                                                <th>Comment</th>
                                                <th>Verified&nbsp;by</th>
                                                <th>Created</th>
                                                <th></th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {assertion.verified.map((verified: any, idx: number) => (
                                                <tr key={idx} className="userVerificationTemplate">
                                                    <td className="qaStatus i8nupdate">{translate(intl, verified.qaStatus, 'user_assertions')}</td>
                                                    <td className="comment">{verified.comment}</td>
                                                    <td className="userDisplayName">{verified.userDisplayName}</td>
                                                    <td className="created">
                                                        {new Date(verified.created).toLocaleString('en-CA', { hour12: false }).replace(',', '').replace(/\//g, '-')}
                                                    </td>
                                                    <td className="deleteVerification">
                                                        {isCollectionAdmin() && <>
                                                            <a className="editVerificationButton btn btn-danger"
                                                               style={{textAlign: "right"}} href="#">
                                                                <FormattedMessage id="show.userannotationtemplate.p06.navigator" defaultMessage="Edit"/>
                                                            </a>
                                                            <a className="deleteVerificationButton btn btn-danger"
                                                               style={{textAlign: "right"}} href="#">
                                                                <FormattedMessage id="show.userannotationtemplate.p04.navigator" defaultMessage="Delete this verification"/>
                                                            </a>
                                                        </>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {assertion.disableDelete &&
                                                <tr className="userVerificationTemplate">
                                                    <td className="qaStatus i8nupdate">User Verification Status</td>
                                                    <td className="comment">Comment</td>
                                                    <td className="userDisplayName">Verified By</td>
                                                    <td className="created">Created</td>
                                                    <td className="deleteVerification"><FormattedMessage id="show.userannotationtemplate.p04.navigator" defaultMessage="Delete this verification"/></td>
                                                </tr>
                                            }
                                            </tbody>
                                        </table>
                                    }
                                </li>
                        ))}
                </ul>
            </div>
        }
    </>
}

export default OccurrenceAssertions;
