/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/esm/Modal";
import { FormattedMessage, IntlShape } from 'react-intl';
import { useIntl } from '../util/useIntl';
import CopyTooltip from './copyTooltip.tsx';

interface ApiModalProps {
    onClose: () => void
    url: string
}

function ApiModal({onClose, url}: ApiModalProps) {
    const intl: IntlShape = useIntl();

    function copy() {
        // copy "url" to clipboard
        navigator.clipboard.writeText(url)
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title><FormattedMessage id="list.copylinks.dlg.title" defaultMessage="JSON web service API"/></Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="input-group input-group-sm align-content-end">
                    <input type="text" className="form-control mt-2" readOnly={true} disabled={true} value={url} />
                    <button className="btn btn-outline-dark mt-2" onClick={() => copy()}>
                        <CopyTooltip text={intl.formatMessage({id: "list.copylinks.tooltip.copytoclipboard", defaultMessage: 'copied!'})}>
                            <FormattedMessage id="list.copylinks.dlg.copybutton.text" defaultMessage="Copy URL"/>
                        </CopyTooltip>
                    </button>
                </div>
            </Modal.Body>
        </Modal>
    </>
}

export default ApiModal;
