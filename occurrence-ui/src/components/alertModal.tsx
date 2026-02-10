/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/Modal";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';

interface AlertModalProps {
    onClose: () => void,
    results: any,
    queryString: string | undefined
}

function AlertModal({onClose, results, queryString}: AlertModalProps) {

    const intl: IntlShape = useIntl();

    function createNewRecordAlert() {
        createAlert('createBiocacheNewRecordsAlert')
    }

    function createNewAnnotationsAlert() {
        createAlert('createBiocacheNewAnnotationsAlert')
    }

    function createAlert(method: string) {
        // this would be better as a POST service, but I guess this works
        let url = "https://alerts-test.ala.org.au/ws/" + method;
        if (results.queryTitle.length >= 250) {
            url += "?queryDisplayName=" + encodeURIComponent(results.queryTitle.substring(0, 149) + "...");
        } else {
            url += "?queryDisplayName=" + encodeURIComponent(results.queryTitle);
        }
        url += "&baseUrlForWS=" + encodeURIComponent(import.meta.env.VITE_APP_BIOCACHE_URL);
        url += "&baseUrlForUI=" + encodeURIComponent(import.meta.env.VITE_OIDC_REDIRECT_URL);
        url += "&webserviceQuery=%2Foccurrences%2Fsearch%3F" + encodeURIComponent(queryString || '');
        url += "&uiQuery=%23%2Foccurrences%2Fsearch%3F" + encodeURIComponent(queryString || '');
        url += "&resourceName=" + encodeURIComponent(import.meta.env.VITE_ORG_NAME);

        window.location.href = url;
    }

    return (
        <>
            <Modal show={true} onHide={onClose}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FormattedMessage id='list.alert.title' defaultMessage='Email alerts' />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='btn border-black' title={intl.formatMessage({id: 'list.alert.navigator01.title'})} onClick={() => createNewRecordAlert()}
                         dangerouslySetInnerHTML={{__html: intl.formatMessage({ id: 'list.alert.navigator01', defaultMessage: "Get email alerts for new records" })}}></div>
                    <br />

                    <div className='btn border-black mt-4' title={intl.formatMessage({id: 'list.alert.navigator02.title'})}  onClick={() => createNewAnnotationsAlert()}
                         dangerouslySetInnerHTML={{__html: intl.formatMessage({ id: 'list.alert.navigator02', defaultMessage: "Get email alerts for new annotations" })}}></div>
                    <p>&nbsp;</p>
                    <p>
                        <a href={import.meta.env.VITE_APP_MY_ALERTS_URL}>
                            <FormattedMessage id="list.alert.navigator03" defaultMessage="View your current alerts"/></a>
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <button className='btn border-black' onClick={() => onClose()}>
                        <FormattedMessage id="list.alert.button01" defaultMessage="Close"/>
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default AlertModal;
