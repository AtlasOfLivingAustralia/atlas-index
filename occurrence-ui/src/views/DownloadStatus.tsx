import { Breadcrumb, FontAwesomeIconLite, useUser } from '@ala/common-ui';
import config from '../../config/config.json';
import './download.css';
import { faCheckCircle, faDownload} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { FormattedMessage, IntlShape, useIntl} from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';

const mintDoi = import.meta.env.VITE_DOWNLOAD_MINT_DOI === 'true';
const sendEmail = import.meta.env.VITE_DOWNLOAD_SEND_EMAIL === 'true';
const sourceTypeId = Number(import.meta.env.VITE_DOWNLOAD_SOURCE_TYPE_ID); // hubs download
const qaDefault = import.meta.env.VITE_DOWNLOAD_QA_DEFAULT;
const statusCheckInterval = Number(import.meta.env.VITE_DOWNLOAD_STATUS_CHECK_INTERVAL); // ms
const maxFieldguideSpecies = Number(import.meta.env.VITE_DOWNLOAD_MAX_FIELDGUIDE_SPECIES);
// for downloadFormat == 'legacy'
const fieldsDefault = import.meta.env.VITE_DOWNLOAD_FIELDS_DEFAULT;
const fieldsExtra = import.meta.env.VITE_DOWNLOAD_FIELDS_EXTRA;
// for downloadFormat == 'dwc'
const dwcExtraFields = import.meta.env.VITE_DOWNLOAD_DWC_EXTRA_FIELDS;
const dwcDownloadIncludeRaw = import.meta.env.VITE_DOWNLOAD_DWC_INCLUDE_RAW === 'true';

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
        customFields: params.get('customFields'),
        customClasses: params.get('customClasses'),
        layers: params.get('layers'),
        customHeader: params.get('customHeader'),
        layersServiceUrl: params.get('layersServiceUrl')
    };
}

function DownloadStatus({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const [error, setError] = useState<string | null>(null);
    const [isRecords, setIsRecords] = useState<boolean>(false);
    const [isFieldGuide, setIsFieldGuide] = useState<boolean>(false);
    const [_, setIsChecklist] = useState<boolean>(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [json, setJson] = useState<string | null>(null);
    const [lead, setLead] = useState<string>('');
    const [showProgress, setShowProgress] = useState<boolean>(true);

    const { searchParams, filename, downloadFormat, fileType, downloadType, downloadReason, customClasses, layers, customHeader, layersServiceUrl } = getQueryParameters();
    const {userInfo} = useUser();
    const intl: IntlShape = useIntl();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
            {title: 'Download status', href: '/'},
        ]);
    }, []);

    useEffect(() => {
        if (!searchParams) {
            setError('ERROR: No search parameters provided for download.');
            return;
        }

        if (!userInfo) {
            setError('ERROR: User not logged in.');
            return;
        }

        if (!filename) {
            setError('ERROR: No filename provided for download.');
            return;
        }

        if (!location.state?.fromNavigate) {
            // page is loaded directly, not via navigate from one of the downloads pages, do not repeat download
            setLead(intl.formatMessage({ id: "download.confirm.started"}));
            setError(intl.formatMessage({ id: "download.confirm.completed"}));
            return;
        } else {
            // remove state to prevent re-triggering download on reload
            navigate(location.pathname + location.search, { replace: true, state: undefined });
        }

        if (downloadType === 'records') {
            startDownloadRecords();
        } else if (downloadType === 'fieldguide') {
            startDownloadFieldguide();
        } else if (downloadType === 'checklist') {
            startDownloadChecklist();
        }
    }, [userInfo]);

    function startDownloadChecklist() {
        setIsChecklist(true);
        setLead(intl.formatMessage({ id: "download.confirm.finished"}));
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/facets/download${searchParams}&file=${filename}&reasonTypeId=${encodeURIComponent(downloadReason || '')}&dwcHeaders=true&fileType=csv&qa=${qaDefault}&sourceTypeId=${sourceTypeId}&email=${encodeURIComponent(userInfo?.email || '')}&facets=species_guid&lookup=true&count=true&lists=true`;
        setDownloadUrl(url);
    }

    function startDownloadFieldguide() {
        setIsFieldGuide(true);
        setLead(intl.formatMessage({ id: "download.confirm.queued"}));
        setShowProgress(true);

        // get the list of species
        let url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search${searchParams}&pageSize=0&flimit=${maxFieldguideSpecies}&facets=species_guid&facet=true`;
        fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
            .then(response => response.json())
            .then(json => {
                let speciesGuids: string[] = [];
                if (json?.facetResults && json.facetResults.length > 0) {
                    speciesGuids = json.facetResults[0].fieldResult.filter((facet: any) => !facet.fq.endsWith('*')).map((facet: any) => facet.label);
                }

                if (speciesGuids.length === 0) {
                    setError(intl.formatMessage({ id: "download.confirm.nospecies"}));
                    setShowProgress(false);
                    return;
                }

                // construct parameters
                let body = {
                    sourceUrl: `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search${searchParams || ''}`,
                    filename: filename,
                    id: speciesGuids,
                    title: "This document was generated on " + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                }

                fetch(import.meta.env.VITE_APP_FIELDGUIDE_DOWNLOAD_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userInfo?.accessToken}` },
                    body: JSON.stringify(body)
                })
                .then(response => response.json())
                .then(json2 => {
                    setJson(json2);
                    if (json2?.statusUrl) {
                        reloadStatus(json2.statusUrl);
                    }
                })
                .catch(error => {
                    setShowProgress(false);
                    setError(error.toString());
                });
            }).catch(error => {
                setShowProgress(false);
                setError(error.toString());
            });
    }

    function startDownloadRecords() {
        setIsRecords(true);
        setLead(intl.formatMessage({ id: "download.confirm.queued"}));
        setShowProgress(true);

        // construct parameters for downloadFormat == 'legacy'
        const emailParam = `&email=${encodeURIComponent(userInfo?.email || '')}`;
        const reasonTypeIdParam = downloadReason ? `&reasonTypeId=${encodeURIComponent(downloadReason)}` : '';
        const sourceTypeIdParam = `&sourceTypeId=${sourceTypeId}`;
        const fileTypeParam = `&fileType=${fileType || 'csv'}`;
        const requestEmailParam = sendEmail ? `&emailNotify=true` : `&emailNotify=false`;
        let dwcHeadersParam = `&dwcHeaders=false`;
        const mintDoiParam = mintDoi ? `&mintDoi=true` : `&mintDoi=false`;
        let qaParam = `&qa=${qaDefault}`;
        const fileParam = `&file=${filename}`;
        let fieldsParam = '';
        let extraParam = fieldsExtra ? `&extra=${fieldsExtra}` : ''; // downloadFormat == 'legacy' only
        const spatialLayerParams = customHeader && layersServiceUrl ? `&customHeader=${encodeURIComponent(customHeader)}&layersServiceUrl=${encodeURIComponent(layersServiceUrl)}` : '';


        // always put fields into a future as downloadFormat may be 'dwc' or 'custom'
        let fieldsFuture: Promise<string> = Promise.resolve(fieldsDefault); // default for downloadFormat == 'legacy'

        // update for downloadFormat == 'dwc' or 'custom'
        if (downloadFormat !== 'legacy') {
            extraParam = '';
            dwcHeadersParam = `&dwcHeaders=true`;

            fieldsFuture = fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/index/fields`, { method: 'GET' })
                .then(response => response.json())
                .then((allFields: any[]) => {
                    if (downloadFormat === 'dwc') {
                        // include all DWC terms plus extra fields, and optional raw_
                        const dwcTerms = allFields.filter(field => !!field.dwcTerm && (dwcDownloadIncludeRaw || !field.name.startsWith('raw_'))).map(field => field.name);
                        const extraFields = dwcExtraFields ? ',' + dwcExtraFields : '';
                        return dwcTerms.join(',') + extraFields;
                    } else { // downloadFormat === 'custom'
                        const classes = (customClasses || '').split(',').filter(Boolean);

                        const configFields: Record<string, string[]> = config.download.custom;

                        // DwC class group keys (mirrors grailsApplication.config.downloads.customSections.darwinCore)
                        const darwinCoreClasses = [
                            'recordLevelTerms', 'occurrence', 'organism', 'materialSampleSpecimen',
                            'event', 'location', 'identification', 'taxon', 'measurementOrFact',
                            'geologicalContext', 'resourceRelationship',
                        ];

                        // Map DwC group key -> dwcClass value used in /index/fields classs property
                        const groupKeyToClass: Record<string, string> = {
                            recordLevelTerms: 'Record',
                            occurrence: 'Occurrence',
                            organism: 'Organism',
                            materialSampleSpecimen: 'MaterialSample',
                            event: 'Event',
                            location: 'Location',
                            identification: 'Identification',
                            taxon: 'Taxon',
                            measurementOrFact: 'MeasurementOrFact',
                            geologicalContext: 'GeologicalContext',
                            resourceRelationship: 'ResourceRelationship',
                        };

                        const customFieldsList: string[] = dwcExtraFields ? dwcExtraFields.split(',') : [];
                        let qaOverride = '';
                        let includeMisc = false;
                        const extraList: string[] = [];

                        for (const cls of classes) {
                            if (darwinCoreClasses.includes(cls)) {
                                // Resolve fields for this DwC class from the already-fetched allFields
                                const dwcClass = groupKeyToClass[cls];
                                const matched = allFields
                                    .filter(f => (f.classs || '').toLowerCase() === dwcClass.toLowerCase())
                                    .map(f => f.name);
                                customFieldsList.push(...matched);
                            } else if (configFields[cls]) {
                                customFieldsList.push(...configFields[cls]);
                            } else if (cls === 'qualityAssertions') {
                                qaOverride = 'includeall';
                            } else if (cls === 'miscellaneousFields') {
                                includeMisc = true;
                            } else if (cls === 'selectedLayers') {
                                // already added to extra by spatial-hub
                            } else if (cls === 'environmentalLayers') {
                                const matched = allFields.filter(f => /^el\d/i.test(f.name)).map(f => f.name);
                                customFieldsList.push(...matched);
                            } else if (cls === 'contextualLayers') {
                                const matched = allFields.filter(f => /^cl\d/i.test(f.name)).map(f => f.name);
                                customFieldsList.push(...matched);
                            } else if (/^dr\d+/.test(cls)) {
                                extraList.push(cls);
                            } else {
                                console.warn('Custom field class not recognised:', cls);
                            }
                        }

                        if (qaOverride) qaParam = `&qa=${qaOverride}`;
                        if (extraList.length) extraParam = `&extra=${extraList.join(',')}`;
                        if (includeMisc) extraParam += '&includeMisc=true';

                        return customFieldsList.filter(f => f).join(',');
                    }
                });
        }

        // append layers to extra
        if (layers) {
            if (extraParam) {
                extraParam += layers ? ',' + layers : '';
            } else {
                extraParam = `&extra=${layers}`;
            }
        }

         // wait for future to complete, needed when downloadFormat === 'dwc'
        fieldsFuture.then((fields: string) => {
            // override the fields param when downloadFormat === 'dwc', otherwise 'fields' will be ''
            if (fields) {
                fieldsParam = `&fields=${fields}`;
            }

            // Future: This should be a POST, but only URL params are supported for now so leaving as GET
            let url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/offline/download${searchParams}${emailParam}${reasonTypeIdParam}${sourceTypeIdParam}${requestEmailParam}${dwcHeadersParam}${mintDoiParam}${qaParam}${fileParam}${fieldsParam}${extraParam}${fileTypeParam}${spatialLayerParams}`;
            fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${userInfo?.accessToken}` }, })
                .then(response => response.json())
                .then(json => {
                    setJson(json);
                    if (json?.statusUrl) {
                        reloadStatus(json.statusUrl);
                    }
                })
                .catch(error => {
                    setError(error);
                    setShowProgress(false);
                });
        });
    }

    function reloadStatus(statusUrl: string) {
        setTimeout(() => {checkStatus(statusUrl);}, statusCheckInterval);
    }

    function checkStatus(statusUrl: string) {
        fetch(statusUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userInfo?.accessToken}` }, })
            .then(response => response.json())
            .then(json => {
                setJson(json);

                let status = json.status || json.statusCode;

                if ((status == "QUEUED" || status == "inQueue") && json.statusUrl) {
                    setLead(intl.formatMessage({ id: "download.confirm.queued"}));
                    reloadStatus(json.statusUrl);
                } else if (status == "RUNNING" && json.statusUrl) {
                    setLead(intl.formatMessage({ id: "download.confirm.running"}));
                    reloadStatus(statusUrl);
                } else if (status.toLowerCase() == "skipped") {
                    setLead(intl.formatMessage({ id: "download.confirm.skipped"}));
                } else if (status.toLowerCase() == "finished") {
                    setLead(intl.formatMessage({ id: "download.confirm.finished"}));
                    setDownloadUrl(json.downloadUrl);
                } else if (status.toLowerCase() == "cancelled") {
                    setLead(intl.formatMessage({ id: "download.confirm.cancelled"}));
                } else {
                    // Error cases
                    setLead(intl.formatMessage({ id: "download.confirm.failed"}));
                    var errorMessage = "";
                    if (status) {
                        errorMessage = "status: <code>" + status + "</code><br/>";
                    }
                    if (json.message) {
                        errorMessage = errorMessage + "message: <code>" + json.message + "</code>";
                    }
                    setError(errorMessage);
                }

            }).catch(error => {
                setError('Error checking download status: ' + error);
            });
    }

    return (
        <div style={{ margin: '0 auto', maxWidth: '360px' }}>
            <div className='well'>
                <div className='d-flex flex-column align-items-center'>
                    <FontAwesomeIconLite icon={faCheckCircle} style={{ color: '#65B044', fontSize: '113px', marginTop: '50px' }} />
                    <h2 className='heading-medium-large' style={{ textAlign: 'center', marginTop: '50px'}}>
                        <FormattedMessage id='download.confirm.thanks' defaultMessage='Thank you for your download' />
                    </h2>
                    <p className='lead'>
                        {lead && <>{lead}</>}
                    </p>
                    <div style={{ textAlign: 'center'}}>
                        {(isRecords || isFieldGuide) && json ? (
                            <>
                                {showProgress && !downloadUrl && !error &&
                                    <div className='progress active' style={{backgroundColor: '#f26649'}}>
                                        <div className='progress-bar progress-bar-striped progress-bar-animated w-100'></div>
                                    </div>
                                }
                                {downloadUrl &&
                                    <div id='queueStatus'>
                                        <a className='btn btn-primary' href={downloadUrl}>
                                            <FontAwesomeIconLite icon={faDownload} /> <FormattedMessage id="download.confirm.download.now"/>
                                        </a>
                                    </div>
                                }
                                {error && !downloadUrl && <div id='queueStatus'>{error}</div>}
                                <p>&nbsp;</p>
                                <FormattedMessage id='download.confirm.emailed' defaultMessage='An email containing a link to the download file will be sent to your email address (linked to your ALA account) when it is completed.' />
                            </>
                        ) : downloadUrl ?
                            <div id='queueStatus' className='mb-5'>
                                <a className='btn btn-primary' href={downloadUrl}>
                                    <FontAwesomeIconLite icon={faDownload} /> <FormattedMessage id="download.confirm.download.now"/>
                                </a>
                            </div>
                            :
                            <>{error && <div id='queueStatus'>{error}</div>}</>
                        }
                    </div>
                    <p>&nbsp;</p>
                    <a href={`/occurrences/search${searchParams}`} className='btn btn-primary btn-block margin-bottom-1 font-xxsmall w-100' type='button'>
                        <FormattedMessage id='download.confirm.returnToSearch' defaultMessage='Return to search results' />
                    </a>
                </div>
            </div>
            <div id='mydownloads' style={{ textAlign: 'center', marginBottom: '120px' }}>
                <a href={import.meta.env.VITE_APP_MY_DOWNLOADS_URL} target='_blank'>
                    <FormattedMessage id='download.confirm.myDownloadsLink' defaultMessage='My Downloads - View a list of all your previous downloads' />
                </a>
            </div>
        </div>
    );
}

export default DownloadStatus;
