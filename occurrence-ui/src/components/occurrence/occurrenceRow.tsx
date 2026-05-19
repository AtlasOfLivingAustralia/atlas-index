/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from "react";
import {IntlShape, useIntl} from "react-intl";
import {OccurrenceTableRowProps} from "../../api/model.tsx";
import {sanitizeBodyText, translate} from "../../util/util.tsx";

function formatFieldName(intl: IntlShape, fieldCode?: string, fieldName?: string) {
    if (!fieldName) return fieldCode || "";

    let output = "";
    if (fieldName.endsWith("_s") || fieldName.endsWith("_i") || fieldName.endsWith("_d")) {
        const temp = fieldName.slice(0, -2).replace(/_/g, " ");
        output = intl.formatMessage({id: `facet.${fieldName}`, defaultMessage: temp});
    } else if (fieldName.endsWith("_RNG")) {
        output = fieldName.slice(0, -4).replace(/_/g, " ") + " (range)";
    } else {
        output = intl.formatMessage({id: `facet.${fieldCode}`, defaultMessage:
                intl.formatMessage({id: fieldCode || "", defaultMessage: fieldName})});
    }
    return output;
}


export const OccurrenceTableRow: React.FC<OccurrenceTableRowProps> = ({
                                                                          fieldName,
                                                                          fieldCode,
                                                                          url,
                                                                          text,
                                                                          original,
                                                                          originalUrl,
                                                                          style
                                                                      }) => {
    const intl: IntlShape = useIntl();

    if (!text && !original) {
        return null;
    }

    let plainText = "";
    if (Array.isArray(text)) {
        text.map((value: string, idx: number) => `${text.length > 1 ? idx + 1 + ". " : ''}${value}'`).join(' ')
        plainText = text.join(', ');
    } else if (text && typeof text === 'string') {
        plainText = translate(intl, text, fieldCode);
    } else {
        plainText = text ? text.toString() : '';
    }

    let plainUrl = url?.match(/^https?:\/\//) ? url : undefined;

    let sanitizedText = sanitizeBodyText(plainText);

    // do not render empty rows
    if (!plainText && !original) {
        return null;
    }

    return (
        <tr id={fieldCode}>
            <td className={`dwcLabel ${fieldCode}`}>{formatFieldName(intl, fieldCode, fieldName)}</td>
            <td className='value' style={style}>
                {plainUrl ? <a href={plainUrl}>{sanitizedText}</a> : <span dangerouslySetInnerHTML={{ __html: sanitizedText }} />}
                {original && (
                    <>
                        {plainText && <br />}
                        {originalUrl ? (
                            <a href={originalUrl}>
                                <span className='originalValue'>{original}</span>
                            </a>
                        ) : (
                            <span className='originalValue'>{original}</span>
                        )}
                    </>
                )}
            </td>
        </tr>
    );
};
