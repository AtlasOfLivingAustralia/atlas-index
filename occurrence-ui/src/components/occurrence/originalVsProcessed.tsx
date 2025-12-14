/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FormattedMessage } from 'react-intl';

function OriginalVsProcessed({ compareRecord, onClose }: { compareRecord: any, onClose: any }) {
    if (!compareRecord) {
        return <div>no compare record</div>;
    }

    return (
        <div id='processedVsRawView' className='modal fade in show'  style={{display: 'block'}} role='dialog'
            aria-labelledby='processedVsRawViewLabel'>
            <div className='modal-dialog modal-lg' role='document'>
                <div className='modal-content'>
                    <div className='modal-header'>
                        <button type='button' className='close' data-dismiss='modal' aria-hidden='true'
                        onClick={onClose}>
                            ×
                        </button>
                        <h3 id='processedVsRawViewLabel'>
                            <FormattedMessage id='show.processedvsrawview.title' defaultMessage='"Original versus Processed" Comparison Table' />
                        </h3>
                    </div>
                    <div className='modal-body'>
                        <table className='table table-bordered table-striped table-condensed'>
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
                                                      <td className='noStripe' rowSpan={fields.length}>
                                                          <b>
                                                              <FormattedMessage id={`facet.group.${groupKey}`} defaultMessage={groupKey} />
                                                          </b>
                                                      </td>
                                                  )}
                                                  <td>{field.name}</td>
                                                  <td>{field.raw}</td>
                                                  <td>{field.processed}</td>
                                              </tr>
                                          ))
                                        : null
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className='modal-footer'>
                        <button className='btn btn-default btn-small' data-dismiss='modal' aria-hidden='true'
                        onClick={onClose}>
                            <FormattedMessage id='show.processedvsrawview.button.close' defaultMessage='Close' />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OriginalVsProcessed;
