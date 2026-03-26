/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Breadcrumb, handleLogin, useUser } from '@ala/common-ui';
import { useEffect, useState } from 'react';
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import './download.css';
import DownloadToolbar from '../components/download/DownloadToolbar.tsx';
import FieldSectionsPanel, { Section } from '../components/download/FieldSectionsPanel.tsx';

const termsOfUseUrl = import.meta.env.VITE_TERMS_OF_USE_URL;
const orgNameLong = import.meta.env.VITE_HUB_NAME;
const mandatoryFieldGroups: string[] = (import.meta.env.VITE_DOWNLOAD_CUSTOM_MANDATORY_GROUPS as string | undefined)
    ? (import.meta.env.VITE_DOWNLOAD_CUSTOM_MANDATORY_GROUPS as string).split(',')
    : ['recordLevelTerms', 'occurrence'];


/**
 * Fixed mapping of section keys to their ordered group keys.
 * Groups are populated with matching fields from biocache /index/fields.
 */
interface GroupEntry {
    key: string;
    filter?: string;
    staticFields?: string;
}

// Config-driven field lists (will eventually come from external JSON at build time)
const SECTION_GROUP_MAP: { section: string; groups: GroupEntry[] }[] = [
    {
        section: 'darwinCore',
        groups: [
            { key: 'recordLevelTerms',       filter: 'classs:Record' },
            { key: 'occurrence',             filter: 'classs:Occurrence' },
            { key: 'organism',               filter: 'classs:Organism' },
            { key: 'event',                  filter: 'classs:Event' },
            { key: 'location',               filter: 'classs:Location' },
            { key: 'identification',         filter: 'classs:Identification' },
            { key: 'taxon',                  filter: 'classs:Taxon' },
            { key: 'measurementOrFact',      filter: 'classs:MeasurementOrFact' },
            { key: 'geologicalContext',      filter: 'classs:GeologicalContext' },
            { key: 'resourceRelationship',   filter: 'classs:ResourceRelationship' },
            { key: 'materialSampleSpecimen', filter: 'classs:MaterialSample' },
        ],
    },
    {
        section: 'speciesTraits',
        groups: [
            { key: 'conservationStatus', filter: 'name:.*Conservation',               staticFields: 'countryConservation, stateConservation, raw_stateConservation' },
            { key: 'otherTraits',        filter: 'speciesGroup|speciesSubgroup', staticFields: 'speciesGroup, speciesSubgroup' },
        ],
    },
    {
        section: 'spatialIntersections',
        groups: [
            { key: 'environmentalLayers', filter: 'name:el[0-9]*', staticFields: 'All el… (environmental) fields' },
            { key: 'contextualLayers',    filter: 'name:cl[0-9]*', staticFields: 'All cl… (contextual) fields' },
            { key: 'selectedLayers',                               staticFields: 'Layers selected in Spatial Portal' },
        ],
    },
    {
        section: 'misc',
        groups: [
            { key: 'qualityAssertions',   filter: 'assertion', staticFields: "All QA fields - <a href='https://biocache-ws.ala.org.au/ws/occurrences/search?q=*:*&facets=assertions&pageSize=0&flimit=500' target='_blank'>see the full list</a>" },
            { key: 'miscellaneousFields',                      staticFields: 'All miscellaneous fields' },
            { key: 'dr15515',                                  staticFields: 'WildNet taxon ID field' },
        ],
    },
];

/**
 * All group entries flattened, for use in resolveGroupKey.
 */
const ALL_GROUPS = SECTION_GROUP_MAP.flatMap(s => s.groups);

/**
 * Lookup: dwcClass (lowercased) -> group key, built from "classs:Xxx" filter entries.
 */
const DWC_CLASS_TO_GROUP: Record<string, string> = Object.fromEntries(
    ALL_GROUPS
        .filter(g => g.filter?.startsWith('classs:'))
        .map(g => [g.filter!.replace('classs:', '').toLowerCase(), g.key])
);

/**
 * Map a biocache field to a group key, driven entirely by SECTION_GROUP_MAP filters:
 *   classs:Xxx       -> matched against field.dwcClass (also handles 'record' alias)
 *   name:pattern     -> matched against field.name as regex
 *   a|b|c            -> matched against field.name as OR list
 *   plainValue       -> exact match against field.name or field.info contains it
 * Static-only groups (no filter) are never assigned via this function.
 * Returns null for unmatched fields — they are intentionally dropped.
 */
function resolveGroupKey(field: any): string | null {
    // Explicit downloadGroup on the field takes priority
    if (field.downloadGroup) return field.downloadGroup;

    // 1. DwC class match ('record' is an alias for 'recordlevel')
    const dwcClass = (field.classs || '').toLowerCase();
    if (dwcClass) {
        const byClass = DWC_CLASS_TO_GROUP[dwcClass]
            ?? (dwcClass === 'record' ? DWC_CLASS_TO_GROUP['recordlevel'] : undefined);
        if (byClass) return byClass;
    }

    // Anything not dwcClass-based must have a staticFields value
    return null;
}

/** Build sections from the flat list of index fields returned by biocache /index/fields */
function buildSections(allFields: any[]): Section[] {
    // Collect the set of group keys that use static field descriptions
    const staticGroupKeys = new Set(
        SECTION_GROUP_MAP.flatMap(s => s.groups.filter(g => g.staticFields).map(g => g.key))
    );

    // Bucket API fields into non-static groups only
    const groupFieldsMap = new Map<string, string[]>();
    for (const field of allFields) {
        const groupKey = resolveGroupKey(field);
        if (!groupKey || staticGroupKeys.has(groupKey)) continue;
        if (!groupFieldsMap.has(groupKey)) groupFieldsMap.set(groupKey, []);
        groupFieldsMap.get(groupKey)!.push(field.name);
    }

    return SECTION_GROUP_MAP.map(({ section, groups }) => ({
        key: section,
        groups: groups.map(({ key: groupKey, filter, staticFields }) => ({
            group: groupKey,
            section,
            filter,
            fieldsHtml: staticFields ?? groupFieldsMap.get(groupKey)?.join(', '),
            mandatory: mandatoryFieldGroups.includes(groupKey),
        })).filter((g): g is typeof g & { fieldsHtml: string } => g.fieldsHtml !== undefined), // removes dwcClasses without fields
    }));
}

function getQueryParameters() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    return {
        searchParams: params.get('searchParams'),
        targetUri: params.get('targetUri'),
        filename: params.get('filename'),
        downloadFormat: params.get('downloadFormat'),
        fileType: params.get('fileType'),
        downloadType: params.get('downloadType'),
        downloadReason: params.get('downloadReason'),
        layers: params.get('layers'),
        customHeader: params.get('customHeader'),
        layersServiceUrl: params.get('layersServiceUrl')
    };
}

function CustomDownload({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const [sections, setSections] = useState<Section[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<boolean>(true);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const { searchParams, targetUri, filename, downloadFormat, fileType, downloadType, downloadReason, layers, customHeader, layersServiceUrl } = getQueryParameters();

    const navigate = useNavigate();
    const intl: IntlShape = useIntl();
    const { userInfo } = useUser();

    // Redirect unauthenticated users to the login page.
    // handleLogin() uses the current window.location.href as the return path.
    useEffect(() => {
        if (userInfo !== null && !userInfo.authenticated) {
            handleLogin(import.meta.env.VITE_APP_API_URL);
        }
    }, [userInfo]);

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Occurrence records', href: '/' },
            { title: 'Customise download', href: '#' },
        ]);

        loadFields();
    }, []);

    function loadFields() {
        setLoading(true);

        // Load saved preferences from cookie (if any)
        const savedCookie = getSavedFieldsCookie();

        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/index/fields`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(response => response.json())
            .then((allFields: any[]) => {
                const builtSections = buildSections(allFields);
                setSections(builtSections);

                // Pre-select mandatory groups and saved preferences
                const initialSelection = new Set<string>();
                builtSections.forEach(section => {
                    section.groups.forEach(group => {
                        if (group.mandatory || savedCookie.includes(group.group)) {
                            initialSelection.add(group.group);
                        }
                    });
                });
                setSelectedGroups(initialSelection);
            })
            .finally(() => setLoading(false));
    }

    function getSavedFieldsCookie(): string[] {
        const match = document.cookie.split('; ').find(row => row.startsWith('download_fields='));
        if (match) {
            return match.split('=')[1].split(',');
        }
        return [];
    }

    function toggleGroup(group: string) {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) {
                next.delete(group);
            } else {
                next.add(group);
            }
            return next;
        });
    }

    function onSelectAll() {
        const all = new Set<string>();
        sections.forEach(section => section.groups.forEach(g => all.add(g.group)));
        setSelectedGroups(all);
    }

    function onSelectNone() {
        // Keep mandatory groups selected
        const mandatory = new Set<string>();
        sections.forEach(section =>
            section.groups.forEach(g => {
                if (g.mandatory) mandatory.add(g.group);
            })
        );
        setSelectedGroups(mandatory);
    }

    function onSave() {
        const fields = Array.from(selectedGroups).join(',');
        document.cookie = `download_fields=${fields}; path=/`;
        setSaveMessage(intl.formatMessage({ id: 'download.customize.preferences.saved', defaultMessage: 'Preferences saved.' }));
        setTimeout(() => setSaveMessage(null), 3000);
    }

    function onNext() {
        if (selectedGroups.size === 0) return;

        // Pass selected group keys as customClasses to the biocache download API
        const customClasses = Array.from(selectedGroups).join(',');

        navigate(
            '/download/confirm' +
                '?searchParams=' + encodeURIComponent(searchParams || '') +
                '&targetUri=' + encodeURIComponent(targetUri || '') +
                '&filename=' + encodeURIComponent(filename || '') +
                '&downloadFormat=' + encodeURIComponent(downloadFormat || '') +
                '&fileType=' + encodeURIComponent(fileType || '') +
                '&downloadType=' + encodeURIComponent(downloadType || '') +
                '&downloadReason=' + encodeURIComponent(downloadReason || '') +
                '&customClasses=' + encodeURIComponent(customClasses) +
                (layers ? '&layers=' + encodeURIComponent(layers) : '') +
                (customHeader ? '&customHeader=' + encodeURIComponent(customHeader) : '') +
                (layersServiceUrl ? '&layersServiceUrl=' + encodeURIComponent(layersServiceUrl) : ''),
            { state: { fromNavigate: true } }
        );
    }


    const canNext = selectedGroups.size > 0;

    // return nothing when not yet logged in
    if (!userInfo?.authenticated) {
        return (
            <div className='container-fluid' id='main'>
                ...
            </div>
        );
    }

    return (
        <div className='container-fluid' id='main'>
            <div className='container-sm' id='main-content'>
                <div className='row'>
                    <div className='col-md-10 offset-md-1'>
                        <h2 className='heading-medium'>
                            <FormattedMessage id='download.customize.title' defaultMessage='Customise Download' />
                        </h2>

                        <DownloadToolbar
                            onSelectAll={onSelectAll}
                            onSelectNone={onSelectNone}
                            onSave={onSave}
                            onNext={onNext}
                            canNext={canNext}
                        />

                        {saveMessage && (
                            <div className='alert alert-success alert-dismissible' role='alert'>
                                {saveMessage}
                            </div>
                        )}

                        {loading ? (
                            <div className='well text-center py-4'>
                                <div className='spinner-border text-primary' role='status'>
                                    <span className='visually-hidden'>Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <FieldSectionsPanel
                                sections={sections}
                                selectedGroups={selectedGroups}
                                onToggleGroup={toggleGroup}
                                includeSelectedLayersOption={!!layers}
                            />
                        )}

                        <DownloadToolbar
                            onSelectAll={onSelectAll}
                            onSelectNone={onSelectNone}
                            onSave={onSave}
                            onNext={onNext}
                            canNext={canNext}
                        />

                        <div className='alert alert-info alert-dismissible mt-3' role='alert'>
                            <FormattedMessage
                                id='download.termsofusedownload.01.param'
                                values={{ orgNameLong }}
                                defaultMessage='By downloading this content you are agreeing to use it in accordance with the {orgNameLong}'
                            />
                            &nbsp;
                            <a href={termsOfUseUrl}>
                                <FormattedMessage id='download.termsofusedownload.02' />
                            </a>
                            &nbsp;
                            <FormattedMessage id='download.termsofusedownload.03' />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CustomDownload;

