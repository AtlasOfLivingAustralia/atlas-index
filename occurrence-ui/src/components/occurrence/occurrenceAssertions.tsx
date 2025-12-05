import {IntlShape, useIntl} from "react-intl";
import {RecordResult} from "../../api/model.tsx";
import {translate} from "../../util/util.tsx";


function OccurrenceAssertions({userAssertions, record, isCollectionAdmin}: {
    userAssertions: any[],
    record: RecordResult,
    isCollectionAdmin: () => boolean
}) {

    const intl: IntlShape = useIntl();

    return <>
        {userAssertions && userAssertions.length > 0 &&
            <div id="userAnnotationsDiv" className="additionalData">
                <h3>User flagged issues<a id="userAnnotations">&nbsp;</a></h3>
                <ul>
                    {/* assertionQueries section is deprecated */}

                    {userAssertions.filter((assertion: any) => assertion.code != 50000)
                        .map(((assertion: any, index: number) =>
                                <li className="userAnnotationTemplate well well-sm" key={index}>
                                    <h4>
                                        <span className="issue i8nupdate">{translate(intl, assertion.name, 'assertions')}</span> -
                                        flagged by{" "}
                                        <span className="user">{assertion.userDisplayName}</span>
                                        <span className="userRole">{assertion.userRole}</span>
                                        <span className="userEntity">{assertion.userEntityName}</span>
                                    </h4>
                                    {assertion.relatedRecordReason &&
                                        <p className="related-record-reason">Reason:&nbsp;
                                            <span
                                                className="related-record-reason-span i8nupdate">
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
                                                &nbsp;&nbsp;&nbsp;&nbsp;record ID:&nbsp;<span
                                                className="related-record-id-span">{assertion.relatedRecordId}</span>
                                            </p>

                                            {assertion?.relatedRecord?.scientificName && (
                                                <p className="related-record-name">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;scientific name: <span
                                                    className="related-record-name-span">{assertion.relatedRecord.scientificName}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.stateProvince && (
                                                <p className="related-record-state">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;state: <span
                                                    className="related-record-state-span">{assertion.relatedRecord.stateProvince}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.decimalLatitude && (
                                                <p className="related-record-latitude">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;latitude: <span
                                                    className="related-record-latitude-span">{assertion.relatedRecord.decimalLatitude}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.decimalLongitude && (
                                                <p className="related-record-longitude">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;longitude: <span
                                                    className="related-record-longitude-span">{assertion.relatedRecord.decimalLongitude}</span>
                                                </p>
                                            )}
                                            {assertion?.relatedRecord?.eventDate && (
                                                <p className="related-record-eventdate">
                                                    &nbsp;&nbsp;&nbsp;&nbsp;eventDate: <span
                                                    className="related-record-eventdate-span">{assertion.relatedRecord.eventDate}</span>
                                                </p>
                                            )}
                                            <a className="related-record-link"
                                               href={`/occurrence/${assertion.relatedRecordId}`}
                                               target="_blank">
                                                {assertion.code === 20020 ?
                                                    <span className="related-record-span-user-duplicate">View duplicated record</span> :
                                                    <span
                                                        className="related-record-span-default">View related record</span>
                                                }
                                            </a>
                                        </p>}
                                    {assertion.comment &&
                                        <p className="comment">Comment: {assertion.comment}</p>}
                                    <p className="hide issueCode">{assertion.issueCode}</p>
                                    {/*<p className="hide issueComment">{assertion.comment (duplicate)}</p>*/}
                                    <p className="hide userDisplayName">{assertion.userDisplayName}</p>
                                    <p className="created small">Date
                                        created: {new Date(assertion.created).toLocaleString('en-CA', {hour12: false}).replace(',', '')}</p>
                                    {/*query_assertion_uuid is deprecated*/}
                                    {assertion.userId === record.userId &&
                                        <p className="deleteAnnotation">
                                            <a className="editAnnotationButton btn btn-danger" href="#"
                                               onClick={() => alert('TODO')}>
                                                Edit
                                                <span className="editAssertionSubmitProgress" style={{display: "none"}}>
                                                    <img src="/indicator.gif" alt="indicator icon"/>
                                                </span>
                                            </a>
                                            <a className="deleteAnnotationButton btn btn-danger" href="#"
                                               onClick={() => alert('TODO')}>
                                                Delete this annotation
                                                <span className="deleteAssertionSubmitProgress" style={{display: "none"}}>
                                                    <img src="/indicator.gif" alt="indicator icon"/>
                                                </span>
                                            </a>
                                        </p>
                                    }
                                    {isCollectionAdmin() && (
                                        <p className="verifyAnnotation">
                                            <a className="verifyAnnotationButton btn btn-default"
                                               href="#verifyRecordModal"
                                               onClick={() => alert('TODO')}>
                                                <i className="glyphicon glyphicon-thumbs-up"></i> &nbsp;
                                                Verify this annotation
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
                                                    <td className="created">{new Date(verified.created).toISOString().slice(0, 10)}</td>
                                                    <td className="deleteVerification">
                                                        {isCollectionAdmin() && <>
                                                            <a className="editVerificationButton btn btn-danger"
                                                               style={{textAlign: "right"}} href="#">
                                                                Edit
                                                            </a>
                                                            <a className="deleteVerificationButton btn btn-danger"
                                                               style={{textAlign: "right"}} href="#">
                                                                Delete this verification
                                                            </a>
                                                        </>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {assertion.disableDelete &&
                                                <tr className="userVerificationTemplate">
                                                    <td className="qaStatus i8nupdate">User Verification
                                                        Status
                                                    </td>
                                                    <td className="comment">Comment</td>
                                                    <td className="userDisplayName">Verified By</td>
                                                    <td className="created">Created</td>
                                                    <td className="deleteVerification">Delete this
                                                        Verification
                                                    </td>
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
