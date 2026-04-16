/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FontAwesomeIconLite } from '@ala/common-ui';
import { faCog, faCheck, faTimes, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FormattedMessage } from 'react-intl';

export interface DownloadToolbarProps {
    onSelectAll: () => void;
    onSelectNone: () => void;
    onSave: () => void;
    onNext: () => void;
    canNext: boolean;
}

function DownloadToolbar({ onSelectAll, onSelectNone, onSave, onNext, canNext }: DownloadToolbarProps) {
    return (
        <div className='button-toolbar row mb-3'>
            <div className='col'>
                <div className='btn-group'>
                    <button className='btn btn-outline-dark btn-white' onClick={onSelectAll}>
                        <FontAwesomeIconLite icon={faCheck} />
                        {' '}
                        <span className='d-none d-sm-inline'>
                            <FormattedMessage id='download.customize.select.all' defaultMessage='Select all' />
                        </span>
                    </button>
                    <button className='btn btn-outline-dark btn-white' onClick={onSelectNone}>
                        <FontAwesomeIconLite icon={faTimes} />
                        {' '}
                        <span className='d-none d-sm-inline'>
                            <FormattedMessage id='download.customize.unselect.all' defaultMessage='Unselect all' />
                        </span>
                    </button>
                </div>
            </div>
            <div className='col-auto'>
                <div className='btn-group'>
                    <button className='btn btn-outline-dark btn-white' onClick={onSave}>
                        <FontAwesomeIconLite icon={faCog} />
                        {' '}
                        <span className='d-none d-sm-inline'>
                            <FormattedMessage id='download.customize.save.preferences' defaultMessage='Save preferences' />
                        </span>
                    </button>
                    <button className='btn btn-primary' disabled={!canNext} onClick={onNext}>
                        <span className='d-none d-sm-inline'>
                            <FormattedMessage id='download.customize.next' defaultMessage='Next' />
                        </span>
                        {' '}
                        <FontAwesomeIconLite icon={faChevronRight} style={{ color: '#fff' }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DownloadToolbar;

