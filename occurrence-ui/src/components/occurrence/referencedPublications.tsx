/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import { FormattedMessage, IntlShape } from 'react-intl';
import { useIntl } from '../../util/useIntl';
import {RecordResult} from "../../api/model.tsx";


function ReferencedPublications({record}: { record: RecordResult }) {
    const [publications, setPublications] = useState<any[]>([]);

    const intl: IntlShape = useIntl();

    useEffect(() => {
        if (!record || !record.referencedPublications || record.referencedPublications.length === 0) {
            return;
        }

        fetchPublicationInfo();
    }, [record]);

    function fetchPublicationInfo(idx?: number) {
        const thisIdx = idx || 0;

        if (thisIdx >= record.referencedPublications.length || publications[thisIdx]) {
            return;
        }

        let item = record.referencedPublications[thisIdx];
        if (item.identifier) {
            fetch(item.identifier, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.schemaorg.ld+json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    let thisPublication = data;
                    thisPublication.annotation = item;

                    // add to list
                    publications[0] = thisPublication;
                    setPublications([...publications]);

                    // fetch next
                    fetchPublicationInfo(thisIdx + 1);
                })
        }
    }

    if (!record || !record.referencedPublications || record.referencedPublications.length === 0) {
        return null;
    }

    return <>
        {publications && publications.length > 0 &&
            <div id="referencedPublications" className="additionalData">
                <h3><FormattedMessage id='show.referencedPublications.title' defaultMessage='Referenced in publications' /></h3>
            {publications.map((publication: any, idx: number) => (
                <div className="well well-sm" key={idx}>
                    <h4>
                        Publication:{" "}
                        <a href={import.meta.env.VITE_APP_COLLECTORY_URL + '/public/show/' + publication.annotation?.dataResourceUid}>
                            {publication.name}
                        </a>
                    </h4>
                    <p className="samp"><span className="badge"><FormattedMessage id='show.referencedPublications.doi.01' defaultMessage='DOI' /></span> ${publication['@id']}</p>
                    <p>{publication.description}</p>
                    <h5 style={{marginTop:'25px'}}><FormattedMessage id='show.referencedPublications.doi.01' defaultMessage='Version of the data used in the publication' /></h5>
                    <table className="table">
                        <tbody>
                            { publication.annotation?.scientificName && <tr><td>Scientific name</td><td>{publication.annotation.scientificName}</td></tr>}
                            { publication.annotation?.decimalLatitude && <tr><td>Decimal latitude</td><td>{publication.annotation.decimalLatitude}</td></tr>}
                            { publication.annotation?.decimalLongitude && <tr><td>Decimal longitude</td><td>{publication.annotation.decimalLongitude}</td></tr>}
                            { publication.annotation?.year && <tr><td>Year</td><td>{publication.annotation.year}</td></tr>}
                            { publication.annotation?.month && <tr><td>Month</td><td>{publication.annotation.month}</td></tr>}
                            { publication.annotation?.occurrenceRemarks && <tr><td>Occurrence remarks</td><td>{publication.annotation.occurrenceRemarks}</td></tr>}
                        </tbody>
                    </table>
                    { publication.annotation?.dataResourceUid &&
                        <p className="samp pull right">
                            <a href={'/occurrences/search?q=annotationsUid:' + publication.annotation.dataResourceUid}>
                                {intl.formatMessage({id: 'referenced.publications01', defaultMessage: 'View all data referenced by this publication'})}</a>
                        </p>
                    }
                </div>
            ))}
            </div>
        }
    </>
}



export default ReferencedPublications;
