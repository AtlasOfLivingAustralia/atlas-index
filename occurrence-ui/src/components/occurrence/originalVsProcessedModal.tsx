/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/esm/Modal";
import { FormattedMessage } from 'react-intl';

interface ApiModalProps {
    compareRecord: any
    onClose: () => void
}

function OriginalVsProcessedModal({ compareRecord, onClose }: ApiModalProps) {
    return (
        <>
            <Modal show={true} onHide={onClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FormattedMessage id='show.processedvsrawview.title' defaultMessage='"Original versus Processed" Comparison Table' />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <table className='table table-bordered table-striped table-condensed' style={{ marginBottom: '0px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>
                                    <FormattedMessage id='show.processedvsrawview.table.th01' defaultMessage='Group' />
                                </th>
                                <th style={{ width: '15%' }}>
                                    <FormattedMessage id='show.processedvsrawview.table.th02' defaultMessage='Field Name' />
                                </th>
                                <th style={{ width: '35%' }}>
                                    <FormattedMessage id='show.processedvsrawview.table.th03' defaultMessage='Original Value' />
                                </th>
                                <th style={{ width: '35%' }}>
                                    <FormattedMessage id='show.processedvsrawview.table.th04' defaultMessage='Processed Value' />
                                </th>
                            </tr>
                        </thead>
                    </table>
                    <table className='table table-bordered table-striped table-condensed' style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto', display: 'block' }}>
                        <thead style={{ visibility: 'collapse' }}>
                            <tr>
                                <th style={{ width: '15%', padding: '0px' }}></th>
                                <th style={{ width: '15%', padding: '0px' }}></th>
                                <th style={{ width: '35%', padding: '0px' }}></th>
                                <th style={{ width: '35%', padding: '0px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(compareRecord).map(([groupKey, fields]) =>
                                Array.isArray(fields) && fields.length > 0
                                    ? fields.map((field: any, i: number) => (
                                          <tr key={`${groupKey}-${i}`}>
                                              {i === 0 && (
                                                  <td className='noStripe' rowSpan={fields.length} style={{ wordBreak: 'break-word' }}>
                                                      <b>
                                                          <FormattedMessage id={`facet.group.${groupKey}`} defaultMessage={groupKey} />
                                                      </b>
                                                  </td>
                                              )}
                                              <td style={{ wordBreak: 'break-word', textAlign: 'center' }}>{field.name}</td>
                                              <td style={{ wordBreak: 'break-word', textAlign: 'center' }}>{field.raw}</td>
                                              <td style={{ wordBreak: 'break-word', textAlign: 'center' }}>{field.processed}</td>
                                          </tr>
                                      ))
                                    : null
                            )}
                        </tbody>
                    </table>
                </Modal.Body>
                <Modal.Footer>
                    <button type='button' className='btn btn-default btn-small' onClick={onClose}>
                        <FormattedMessage id='show.processedvsrawview.button.close' defaultMessage='Close' />
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default OriginalVsProcessedModal;
