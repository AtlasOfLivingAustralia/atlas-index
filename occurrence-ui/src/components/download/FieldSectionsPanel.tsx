/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FontAwesomeIconLite } from '@ala/common-ui';
import { faCog, faQuestionCircle, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { FormattedMessage, useIntl } from 'react-intl';
import RolloverTooltip from '../rolloverTooltip.tsx';
import './fieldSectionsPanel.css';

export interface FieldGroup {
    group: string;
    section: string;
    fieldsHtml: string;
    mandatory: boolean;
}

export interface Section {
    key: string;
    groups: FieldGroup[];
}

interface FieldSectionsPanelProps {
    sections: Section[];
    selectedGroups: Set<string>;
    onToggleGroup: (group: string) => void;
    includeSelectedLayersOption: boolean;
}

function FieldSectionsPanel({ sections, selectedGroups, onToggleGroup, includeSelectedLayersOption }: FieldSectionsPanelProps) {
    const intl = useIntl();

    function groupHelpHtml(group: any) {
        let label = intl.formatMessage({id: "downloads.fields.group.${group.group}", defaultMessage: group.group});
        if (group.filter && group.fieldsHtml) {
            return `<a href='/fields?filter=${group.filter}' target='_fields'>${label} (click for full list of fields)</a> which include: ${group.fieldsHtml}`
        }

        if (group.fieldsHtml) {
            return group.fieldsHtml;
        }

        return label;
    }

    return (
        <div className='well'>
            {sections.map((section, sIdx) => (
                <div key={section.key} className={`row ${sIdx > 0 ? 'mt-4' : ''}`} style={{ paddingTop: '10px'}}>
                    <div className='col-md-2 d-none d-md-block'>
                        {sIdx === 0 && (
                            <div className='contrib-stats'>
                                <FontAwesomeIconLite icon={faCog} style={{ color: '#FFBF47', fontSize: '64px' }}/>
                            </div>
                        )}
                    </div>
                    <div className='col-md-8'>
                        <h4 className='text-uppercase'>
                            <FormattedMessage id={`section.${section.key}`} defaultMessage={section.key}/>
                        </h4>
                        <div className='list-group mt-3'>
                            {section.groups.filter(group => includeSelectedLayersOption || group.group != 'selectedLayers').map(group => {
                                const isSelected = selectedGroups.has(group.group);
                                const isDisabled = group.mandatory;
                                return (
                                    <div
                                        className={`list-group-item d-flex download-custom-item align-items-center${isDisabled ? ' disabled' : ''}${isSelected ? ' download-custom-selected' : ''}`}
                                        onClick={() => { if (!isDisabled) onToggleGroup(group.group); }}
                                        title={isDisabled ? intl.formatMessage({id: 'download.customize.required.item.title', defaultMessage: 'This field is required'}) : undefined}>
                                        <h4 className='mb-0 ps-4 flex-grow-1' style={{ fontSize: '16px' }}>
                                            <FontAwesomeIconLite
                                                icon={isSelected ? faToggleOn : faToggleOff}
                                                style={{ width: '18px', marginRight: '5px', color: '#9A9A9A' }}
                                            />
                                            <span>&nbsp;</span>
                                            <FormattedMessage id={`customGroup.${group.group}`} defaultMessage={group.group}/>
                                            {' '}
                                            <RolloverTooltip html={groupHelpHtml(group)} hideDelay={1000}>
                                                <FontAwesomeIconLite icon={faQuestionCircle} style={{ color: '#9A9A9A' }} />
                                            </RolloverTooltip>
                                        </h4>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default FieldSectionsPanel;

