/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState} from 'react';
import {Button, Collapse, Form} from 'react-bootstrap';
import type {SearchCriteriaDefinition, SearchCriterion} from '../api/types';

const OPERATORS = [
    {value: '=', label: 'is exactly'},
    {value: '~', label: 'contains'},
    {value: '!=', label: 'is not'},
    {value: '>', label: 'is greater than'},
    {value: '<', label: 'is less than'}
];

interface AdvancedCriteriaProps {
    onAdd: (criterion: SearchCriterion) => void;
}

/**
 * Public criteria exposed by the existing image-service search implementation.
 * Keeping these display definitions in the UI avoids changing the legacy
 * backend response contract.
 */
export const PUBLIC_IMAGE_CRITERIA: SearchCriteriaDefinition[] = [
    ['alternateFilename', 'alternate filenames / URLs that this image has been found under'],
    ['audience', 'audience DC term'],
    ['calibratedByUser', 'Calibrated by user.'],
    ['contentMD5Hash', 'The MD5 hash of an image'],
    ['contentSHA1Hash', 'The SHA1 hash of an image'],
    ['contributor', 'contributor DC term'],
    ['created', 'created DC term'],
    ['creator', 'An entity primarily responsible for making the resource.'],
    ['dataResourceUid', 'The UID for the data resource associated with this image.'],
    ['description', 'A general description of the image'],
    ['extension', 'The extension of the image file when uploaded'],
    ['imageIdentifier', 'The unique identifier of an image'],
    ['license', 'A legal document giving official permission to do something with the resource.'],
    ['mimeType', 'The content type of the image'],
    ['occurrenceId', 'Associated occurrence ID.'],
    ['originalFilename', 'The original name of the image file when it was uploaded'],
    ['publisher', 'publisher DC term'],
    ['references', 'references DC term'],
    ['rights', 'Rights information associated with the resource.'],
    ['rightsHolder', 'A person or organisation owning or managing rights over the resource.'],
    ['source', 'source DC term'],
    ['title', 'A title for this image'],
    ['type', 'type DC term']
].map(([fieldName, description]) => ({
    id: fieldName,
    type: 'ImageProperty',
    valueType: 'String',
    name: `Image ${fieldName}`,
    fieldName,
    description
}));

/**
 * Lets a user build an advanced search criterion from the admin-configured
 * field definitions (see AdminController#searchCriteria / SearchCriteriaAdmin.tsx).
 */
export default function AdvancedCriteria({onAdd}: AdvancedCriteriaProps) {
    const definitions = PUBLIC_IMAGE_CRITERIA;
    const [fieldId, setFieldId] = useState(String(PUBLIC_IMAGE_CRITERIA[0]?.id ?? ''));
    const [operator, setOperator] = useState(OPERATORS[0].value);
    const [value, setValue] = useState('');
    const [open, setOpen] = useState(false);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const def = definitions.find(d => String(d.id) === fieldId);
        const trimmedValue = value.trim();
        if (!def || !trimmedValue) return;
        onAdd({id: `${def.fieldName}-${Date.now()}`, field: def.fieldName, label: def.name, operator, value: trimmedValue});
        setValue('');
    }

    const selectedDefinition = definitions.find(d => String(d.id) === fieldId);
    const valueType = selectedDefinition?.valueType?.toLowerCase();
    const inputType = valueType === 'number' || valueType === 'integer' || valueType === 'decimal' ? 'number' : 'text';

    return (
        <section className={`advanced-search ${open ? 'advanced-search--open' : ''}`} aria-labelledby="advanced-search-title">
            <button
                type="button"
                className="advanced-search__toggle"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="advanced-search-panel"
                data-testid="toggle-advanced-criteria"
            >
                <span className="advanced-search__toggle-icon" aria-hidden="true"><i className="bi bi-sliders2"/></span>
                <span className="advanced-search__toggle-copy">
                    <span id="advanced-search-title" className="advanced-search__title">Advanced search</span>
                    <span className="advanced-search__subtitle">Build a precise query using image metadata</span>
                </span>
                <span className="advanced-search__toggle-action">
                    {open ? 'Close' : 'Open filters'}
                    <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} aria-hidden="true"/>
                </span>
            </button>
            <Collapse in={open}>
                <div id="advanced-search-panel">
                    <div className="advanced-search__panel">
                    {definitions.length === 0 && (
                        <div className="advanced-search__empty">
                            <i className="bi bi-info-circle" aria-hidden="true"/>
                            No advanced search fields are configured.
                        </div>
                    )}
                    {definitions.length > 0 && (
                        <Form onSubmit={submit}>
                            <div className="advanced-search__builder">
                            <Form.Group className="advanced-search__field">
                                <Form.Label>Search field</Form.Label>
                                <Form.Select value={fieldId} onChange={e => setFieldId(e.target.value)}>
                                    {definitions.map(d => (
                                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="advanced-search__operator">
                                <Form.Label>Match</Form.Label>
                                <Form.Select value={operator} onChange={e => setOperator(e.target.value)}>
                                    {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="advanced-search__value">
                                <Form.Label className="small mb-1">Value</Form.Label>
                                <div className="advanced-search__value-wrap">
                                    <Form.Control
                                        type={inputType}
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                        placeholder={selectedDefinition ? `Enter ${selectedDefinition.name.toLowerCase()}` : 'Enter a value'}
                                        aria-describedby="advanced-search-help"
                                    />
                                    {selectedDefinition?.units && <span className="advanced-search__units">{selectedDefinition.units}</span>}
                                </div>
                            </Form.Group>
                            <Button type="submit" variant="primary" className="advanced-search__add" disabled={!value.trim()}>
                                <i className="bi bi-plus-lg" aria-hidden="true"/> Add filter
                            </Button>
                            </div>
                            <div id="advanced-search-help" className="advanced-search__help">
                                <i className="bi bi-lightbulb" aria-hidden="true"/>
                                {selectedDefinition?.description || 'Choose a field and add a value to narrow the image results.'}
                            </div>
                        </Form>
                    )}
                    </div>
                </div>
            </Collapse>
        </section>
    );
}
