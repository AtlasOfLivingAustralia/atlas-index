
import {useEffect, useState} from "react";
import {FormattedMessage, IntlShape, useIntl} from "react-intl";
import {DqAssertion, RecordResult} from "../../api/model.tsx";
import React from "react";

import dqCodesJson from '../../config/dqCodes.json';

const dqCodes: { [key: string]: DqAssertion } = dqCodesJson;

function Dupication({record}: { record: RecordResult }) {
    const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
    const [representativeDrName, setRepresentativeDrName] = useState<{[key: string] : string}>({});
    const intl: IntlShape = useIntl();

    useEffect(() => {
        getDuplicationDetails();
    }, [record]);

    function getDuplicationDetails() {
        if (!record || !record.processed?.occurrence?.associatedOccurrences) {
            return;
        }

        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/duplicates/${record.processed.uuid}`, {
            method: 'GET',
            headers: {'Content-Type': 'application/json'}
        }).then(response => response.json())
            .then(data => {
                setDuplicateInfo(data);
                getRepresentativeDrNames(data);
            });
    }

    function getRepresentativeDrNames(data: any) {
        const ids = [data.id];
        data.duplicates.forEach((d:any) => ids.push(d.id));

        Promise.all(
            ids.map(id =>
                fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrence/${id}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }).then(response => response.json())
            )
        ).then(dataArray => {
            const drNames: {[key: string] : string} = {};
            dataArray.forEach((item: any) => {
                const drName = item?.processed?.attribution?.dataResourceName;
                if (item?.processed?.uuid) {
                    drNames[item.processed.uuid] = drName;
                }
            });
            setRepresentativeDrName(drNames);
        });
    }

    function tableRow(fieldName: string, fieldValue: string, link?: string) {
        return (
            <tr>
                <td className="fieldName">
                    {fieldName}
                </td>
                <td className="fieldValue" colSpan={3}>
                    {link ?
                        <a href={link} target="_blank">{fieldValue}</a>
                        :
                        fieldValue
                    }
                </td>
            </tr>
        );
    }

    if (!duplicateInfo) {
        return null;
    }

    return (
        <div id="inferredOccurrenceDetails">
            {/*<a href="#inferredOccurrenceDetails" name="inferredOccurrenceDetails" id="inferredOccurrenceDetails" hidden="true"></a>*/}
            <h3><FormattedMessage id="show.inferredoccurrencedetails.title" defaultMessage="Inferred associated occurrence details"/></h3>
            <p style={{marginTop:"5px"}}>
                { duplicateInfo.duplicationStatus == 'R' ?
                    <FormattedMessage id="show.inferredoccurrencedetails.p01" defaultMessage="This record has been identified as the representative occurrence in a group of associated occurrences."/>
                    :
                    <FormattedMessage id="show.inferredoccurrencedetails.p02" defaultMessage="This record is associated with the representative record."/>
                }
                <FormattedMessage id="show.inferredoccurrencedetails.p03" defaultMessage="More information about the duplication detection methods and terminology in use is available here"/>:
                <ul>
                    <li>
                        <a href={import.meta.env.VITE_DUPLICATE_INFO_URL}>{import.meta.env.VITE_DUPLICATE_INFO_URL}</a>
                    </li>
                </ul>
            </p>
            {duplicateInfo && duplicateInfo.duplicates && duplicateInfo.duplicates.length > 0 &&
                <table className="duplicationTable table table-striped table-bordered table-condensed" style={{borderBottom:"none"}}>
                    <tbody>
                        <tr className="sectionName">
                            <th colSpan={4}>
                                <FormattedMessage id="show.table01.title" defaultMessage="Representative Record"/>
                            </th>
                        </tr>
                        { duplicateInfo.uuid && tableRow("Record UUID", duplicateInfo.uuid, `/occurrence/${duplicateInfo.uuid}`) }
                        { representativeDrName[duplicateInfo.uuid] && tableRow("Data Resource", representativeDrName[duplicateInfo.uuid], `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${duplicateInfo.druid}"`) }
                        { duplicateInfo.rawScientificName && tableRow("Raw Scientific Name", duplicateInfo.rawScientificName) }
                        { duplicateInfo.latLong && tableRow("Coordinates", duplicateInfo.latLong) }
                        { duplicateInfo.collector && tableRow("Collector", duplicateInfo.collector) }
                        { duplicateInfo.year && tableRow("Year", duplicateInfo.year) }
                        { duplicateInfo.month && tableRow("Month", duplicateInfo.month) }
                        { duplicateInfo.day && tableRow("Day", duplicateInfo.day) }
                        <tr className="sectionName">
                            <th colSpan={4}>
                                <FormattedMessage id="show.table02.title" defaultMessage="Related records"/>
                            </th>
                        </tr>
                        {duplicateInfo.duplicates.map((dup: any, index: number) => (
                            <React.Fragment key={index}>
                                { dup.uuid && tableRow("Record UUID", dup.uuid, `/occurrence/${dup.uuid}`) }
                                { representativeDrName[dup.uuid] && tableRow("Data Resource", representativeDrName[dup.uuid], `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${dup.druid}"`) }
                                { dup.rawScientificName && tableRow("Raw Scientific Name", dup.rawScientificName) }
                                { dup.latLong && tableRow("Coordinates", dup.latLong) }
                                { dup.collector && tableRow("Collector", dup.collector) }
                                { dup.year && tableRow("Year", dup.year) }
                                { dup.month && tableRow("Month", dup.month) }
                                { dup.day && tableRow("Day", dup.day) }
                                { dup.dupTypes && dup.dupTypes.length > 0 && tableRow("Comments",
                                    dup.dupTypes.map((dupType: any) =>
                                        dqCodes[dupType.id] ?
                                            intl.formatMessage({id: `duplication.${dupType.id}`}) :
                                            dupType.id
                                    ).join(', ')
                                ) }
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            }
{/*                    <!-- Loop through all the duplicate records -->*/}
{/*                    <tr class="sectionName"><td colspan="4"><g:message code="show.table02.title" default="Related records"/></td></tr>*/}
{/*                    <g:each in="${duplicateRecordDetails.duplicates }" var="dup">*/}
{/*                        <g:if test="${dup.uuid}">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Record UUID">*/}
{/*                                <a href="${request.contextPath}/occurrences/${dup.uuid}">${dup.uuid}</a></alatag:occurrenceTableRow>*/}

{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Data Resource">*/}
{/*                                <g:set var="dr"><alatag:getDruid uuid="${dup.uuid}"/></g:set>*/}
{/*                                <a href="${collectionsWebappContext}/public/show/${dr}">${dataResourceCodes?.get(dr)}</a>*/}
{/*                            </alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.rawScientificName}">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Raw Scientific Name">*/}
{/*                                ${dup.rawScientificName}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.latLong}">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Coordinates">*/}
{/*                                ${dup.latLong}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.collector }">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Collector">*/}
{/*                                ${dup.collector}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.year }">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Year">*/}
{/*                                ${dup.year}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.month }">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Month">*/}
{/*                                ${dup.month}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.day }">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Day">*/}
{/*                                ${dup.day}</alatag:occurrenceTableRow>*/}
{/*                        </g:if>*/}
{/*                        <g:if test="${dup.dupTypes }">*/}
{/*                            <alatag:occurrenceTableRow*/}
{/*                                annotate="false"*/}
{/*                                section="duplicate"*/}
{/*                                fieldName="Comments">*/}
{/*                                <g:each in="${dup.dupTypes }" var="dupType">*/}
{/*                                    <g:if test="${dupType.id }">*/}
{/*                                        <g:message code="duplication.${dupType.id}"/>*/}
{/*                                        <br>*/}
{/*                                    </g:if>*/}
{/*                                </g:each>*/}
{/*                            </alatag:occurrenceTableRow>*/}
{/*                            <tr class="sectionName"><td colspan="4"></td></tr>*/}
{/*                        </g:if>*/}
{/*                    </g:each>*/}
{/*                </table>*/}
{/*            </g:if>*/}
{/*        </p>*/}
{/*</g:if>*/}
</div>
    );
}

export default Dupication;
