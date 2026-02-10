/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/esm/Modal";
import { FormattedMessage } from 'react-intl';

interface ContactCuratorModalProps {
    onClose: () => void
    contacts: any
}

const SPAM_ENCODED = '(SPAM_MAIL@ALA.ORG.AU)';

function ContactCuratorModal({ onClose, contacts }: ContactCuratorModalProps) {

    function sendEmail(strEncoded : string) {
        let strAddress = strEncoded.split(SPAM_ENCODED);
        let strAddressStr = strAddress.join("@");
        window.location.href = 'mailto:' + strAddressStr
    }

    function emailLink(email: string, children: React.ReactNode) {

        const encodedEmail = email.replace(/@/g, SPAM_ENCODED);

        const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            sendEmail(encodedEmail);
        };

        return (
            <a href="#" className="link under" onClick={handleClick}>
                {children}
            </a>
        );
    }

    return (
        <>
            <Modal show={true} onHide={onClose} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FormattedMessage id='show.contactcuratorview.title' defaultMessage='Contact curator' />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <FormattedMessage id='show.contactcuratorview.message' defaultMessage='For more details and to report issues about this record, please contact a person mentioned below.'/>{' '}
                    </p>
                    {contacts && contacts.map((c: any, idx: number) => (
                        <div key={idx}>
                            <address>
                                <strong>
                                    {c.contact.firstName} {c.contact.lastName}{' '}
                                    {c.primaryContact && <span className='primaryContact'>*</span>}{' '}
                                </strong>
                                {c.role && <><br />{c.role}<br /></>}
                                {c.contact?.phone && <><abbr title='Phone'>P:</abbr> {c.contact.phone} <br /></>}
                                {c.contact?.email && <>
                                    <abbr title='Email'>E:</abbr>{' '}
                                    {emailLink(c.contact.email, <FormattedMessage id="show.contactcuratorview.emailtext" defaultMessage="email this contact" />)}
                                    <br />
                                </>}
                            </address>
                        </div>
                    ))}
                    <p>
                        <span className='primaryContact'>
                            <b>*</b>
                        </span>{' '}
                        <FormattedMessage id='show.contactcuratorview.primarycontact' defaultMessage='Primary Contact'/>{' '}
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <button className='btn btn-default btn-small' style={{float:"right"}} onClick={() => onClose()}>
                        <FormattedMessage id='show.processedvsrawview.button.close' defaultMessage='Close' />
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default ContactCuratorModal;
