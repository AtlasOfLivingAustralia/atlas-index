/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import Menu from '../components/menu.tsx';
import {Breadcrumb, useUser} from '@ala/common-ui';

// ---- types ------------------------------------------------------------------

type Severity = 'INFO' | 'WARNING' | 'ERROR';

interface BannerEntry {
    message: string;
    severity: Severity;
    updated: string;
}

interface BannerData {
    [section: string]: BannerEntry;
}

// Allowed HTML tags for the banner message
const ALLOWED_TAGS = /^<\/?(a|b|strong|em|i|u|span|br|p|ul|ol|li|small)(\s[^>]*)?>$/i;

/**
 * Very lightweight HTML safety check — rejects tags that aren't in the allow-list.
 * Returns an error string or null if valid.
 */
function validateHtml(value: string): string | null {
    if (!value) return null;
    const tagRegex = /<[^>]+>/g;
    const tags = value.match(tagRegex) ?? [];
    for (const tag of tags) {
        if (!ALLOWED_TAGS.test(tag)) {
            return `Disallowed tag or attribute: ${tag}`;
        }
    }
    // Detect obvious script injection patterns even without < >
    if (/javascript\s*:/i.test(value) || /on\w+\s*=/i.test(value)) {
        return 'Disallowed content: event handlers or javascript: URIs are not permitted.';
    }
    return null;
}

const SEVERITY_OPTIONS: Severity[] = ['INFO', 'WARNING', 'ERROR'];

const SEVERITY_CLASS: Record<Severity, string> = {
    INFO: 'alert-info',
    WARNING: 'alert-warning',
    ERROR: 'alert-danger',
};

// ---- component --------------------------------------------------------------

function BannerMessages({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const {userInfo} = useUser();

    // server state
    const [saved, setSaved] = useState<BannerData>({});
    // working copies — keyed by section
    const [draft, setDraft] = useState<BannerData>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'ok' | 'error'>>({});
    const [previewSection, setPreviewSection] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Banner Messages', href: '/banners'},
        ]);
        fetchBanners();
    }, []);

    function fetchBanners() {
        setLoading(true);
        setFetchError(null);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/banner')
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then((data: BannerData) => {
                setSaved(data);
                setDraft(JSON.parse(JSON.stringify(data))); // deep copy
                setLoading(false);
            })
            .catch(e => {
                setFetchError('Failed to load banner data: ' + e.message);
                setLoading(false);
            });
    }

    function updateDraft(section: string, field: keyof BannerEntry, value: string) {
        const updated: BannerData = {
            ...draft,
            [section]: {...draft[section], [field]: value},
        };
        setDraft(updated);

        // live validation on message
        if (field === 'message') {
            const err = validateHtml(value);
            setValidationErrors(prev => ({...prev, [section]: err ?? ''}));
        }
    }

    function isDirty(section: string): boolean {
        const s = saved[section];
        const d = draft[section];
        if (!s || !d) return false;
        return s.message !== d.message || s.severity !== d.severity;
    }

    function canSave(section: string): boolean {
        return isDirty(section) && !validationErrors[section];
    }

    function save(section: string) {
        const entry = draft[section];
        setSaveStatus(prev => ({...prev, [section]: 'saving'}));
        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/banner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + userInfo?.accessToken,
            },
            body: JSON.stringify({
                section,
                message: entry.message,
                severity: entry.severity,
            }),
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                setSaveStatus(prev => ({...prev, [section]: 'ok'}));
                setSaved(prev => ({...prev, [section]: {...entry}}));
                setTimeout(() => setSaveStatus(prev => ({...prev, [section]: 'idle'})), 2000);
            })
            .catch(() => {
                setSaveStatus(prev => ({...prev, [section]: 'error'}));
            });
    }

    const sections = Object.keys(draft);

    return (
        <div className="d-flex flex-row">
            <Menu/>

            <div className="flex-grow-1 p-3">
                <h4 className="mb-3">Banner Messages</h4>
                <p className="text-muted mb-4">
                    Each section can display an optional banner message in the corresponding UI. Leave the message
                    empty to hide the banner. The message supports a limited set of HTML tags:
                    &lt;a&gt;, &lt;b&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;i&gt;, &lt;u&gt;,
                    &lt;span&gt;, &lt;br&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;small&gt;.
                </p>
                <p className="text-muted mb-4">
                    Caching is applied to banner messages, so changes may take 15 (the default) minutes or so to
                    appear in the UI without clearing client caches.
                </p>

                {fetchError && (
                    <div className="alert alert-danger">{fetchError}</div>
                )}

                {loading && !fetchError && (
                    <div className="text-muted">Loading…</div>
                )}

                {!loading && sections.sort((a, b) => a.localeCompare(b)).map(section => {
                    const entry = draft[section];
                    const dirty = isDirty(section);
                    const validErr = validationErrors[section];
                    const status = saveStatus[section] ?? 'idle';

                    return (
                        <div key={section} className="card mb-3 shadow-sm">
                            <div className="card-body py-2">
                                {/* Single compact row */}
                                <div className="d-flex align-items-start gap-2 flex-wrap">
                                    {/* Section label */}
                                    <span className="fw-bold text-capitalize pt-1" style={{minWidth: '90px'}}>
                                        {section}
                                        {entry.updated && status === 'idle' && (
                                            <small className="text-muted d-block">
                                                <br/>{new Date(entry.updated).toLocaleDateString()}<br/>{new Date(entry.updated).toLocaleTimeString()}
                                            </small>
                                        )}
                                    </span>

                                    {/* Message textarea */}
                                    <div className="flex-grow-1">
                                        <textarea
                                            id={`${section}-msg`}
                                            className={`form-control form-control-sm font-monospace${validErr ? ' is-invalid' : ''}`}
                                            rows={3}
                                            placeholder="(empty — banner hidden)"
                                            value={entry.message}
                                            onChange={e => updateDraft(section, 'message', e.target.value)}
                                        />
                                        {validErr && (
                                            <div className="invalid-feedback">{validErr}</div>
                                        )}
                                    </div>

                                    {/* Severity radios */}
                                    <div className="d-flex flex-column gap-0 pt-1">
                                        {SEVERITY_OPTIONS.map(sev => (
                                            <div key={sev} className="form-check form-check-inline mb-0">
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    id={`${section}-sev-${sev}`}
                                                    name={`${section}-severity`}
                                                    value={sev}
                                                    checked={entry.severity === sev}
                                                    onChange={() => updateDraft(section, 'severity', sev)}
                                                />
                                                <label className="form-check-label small"
                                                       htmlFor={`${section}-sev-${sev}`}>
                                                    {sev}
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="d-flex flex-column gap-1 pt-1">
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={!canSave(section) || status === 'saving'}
                                            onClick={() => save(section)}
                                        >
                                            {status === 'saving' ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() => setPreviewSection(previewSection === section ? null : section)}
                                        >
                                            {previewSection === section ? 'Hide Preview' : 'Preview'}
                                        </button>
                                        {dirty && (
                                            <button
                                                className="btn btn-link btn-sm text-secondary p-0"
                                                onClick={() => {
                                                    setDraft(prev => ({...prev, [section]: {...saved[section]}}));
                                                    setValidationErrors(prev => ({...prev, [section]: ''}));
                                                }}
                                            >
                                                Discard
                                            </button>
                                        )}
                                    </div>

                                    {/* Status indicator */}
                                    <div className="pt-1" style={{minWidth: '80px'}}>
                                        {status === 'ok' && (
                                            <span className="text-success small">
                                                <i className="bi bi-check-circle me-1"/>Saved
                                            </span>
                                        )}
                                        {status === 'error' && (
                                            <span className="text-danger small">
                                                <i className="bi bi-exclamation-circle me-1"/>Failed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Preview */}
                                {previewSection === section && (
                                    <div className="mt-2">
                                        {entry.message ? (
                                            <div
                                                className={`alert ${SEVERITY_CLASS[entry.severity] ?? 'alert-info'} mb-0 py-2`}
                                                style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}
                                            >
                                                <div style={{textAlign: 'center'}}
                                                     dangerouslySetInnerHTML={{__html: entry.message}}/>
                                            </div>
                                        ) : (
                                            <div className="text-muted fst-italic small">
                                                (empty message — banner will be hidden)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default BannerMessages;

