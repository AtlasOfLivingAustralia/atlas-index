import { Breadcrumb, FontAwesomeIconLite, handleLogin, useUser } from '@ala/common-ui';
import { faFilePdf, faListAlt } from '@fortawesome/free-regular-svg-icons';
import { faCheck, faChevronRight, faQuestionCircle, faTable, faTags } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import './download.css';
import RolloverTooltip from '../components/rolloverTooltip.tsx';

const maxRecords = Number(import.meta.env.VITE_DOWNLOAD_MAX_RECORDS);
const downloadFormats = (import.meta.env.VITE_DOWNLOAD_FORMATS as string).split(',');
const fileTypes = (import.meta.env.VITE_DOWNLOAD_FILE_TYPES as string).split(',');
const loggerReasons: { id: number; name: string }[] = JSON.parse(import.meta.env.VITE_DOWNLOAD_LOGGER_REASONS);
const termsOfUseUrl = import.meta.env.VITE_TERMS_OF_USE_URL;
const orgNameLong = import.meta.env.VITE_HUB_NAME;

// TODO: also support the query parameters spatial sends
function getQueryParameters() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    return {
        searchParams: params.get('searchParams'),
        targetUri: params.get('targetUri'),
        layers: params.get('layers'),
        customHeader: params.get('customHeader'),
        layersServiceUrl: params.get('layersServiceUrl')
    };
}

function getDefaultFilenameExt() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function Download({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const [totalRecords, setTotalRecords] = useState<number | null>(null);
    const [filename, setFilename] = useState<string>(`records-${getDefaultFilenameExt()}`);
    const [filenameChecklist, setFilenameChecklist] = useState<string>(`checklist-${getDefaultFilenameExt()}`);
    const [filenameFieldguide, setFilenameFieldguide] = useState<string>(`fieldguide-${getDefaultFilenameExt()}`);
    const [downloadFormat, setDownloadFormat] = useState<string>(downloadFormats[0]);
    const [fileType, setFileType] = useState<string>(fileTypes[0]);
    const [downloadType, setDownloadType] = useState<string>('');
    const [downloadReason, setDownloadReason] = useState<string>('');
    const { searchParams, targetUri, layers, layersServiceUrl, customHeader } = getQueryParameters();

    const intl: IntlShape = useIntl();
    const navigate = useNavigate();
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
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Occurrence records', href: '/'},
            {title: 'Download', href: '/'},
        ]);

        fetchTotalRecords();
    }, []);

    function fetchTotalRecords() {
        if (!searchParams) {
            return;
        }

        fetch(`${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search${searchParams}&pageSize=0`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                setTotalRecords(data.totalRecords);
            });
    }

    // TODO: All of these should only be forwarding the params to the next page, which will do the POSt/download/etc
    function onNext() {
        if (!downloadType || !downloadReason) {
            return;
        }

        if (downloadType === 'records' && downloadFormat == 'custom') {
            // navigate with all query params to /download/options2, as well as filename, downloadType, downloadReason
            navigate('/download/options2?searchParams=' + encodeURIComponent(searchParams || '') +
                '&targetUri=' + encodeURIComponent(targetUri || '') +
                '&filename=' + encodeURIComponent(filename) +
                '&downloadFormat=' + encodeURIComponent(downloadFormat) +
                '&fileType=' + encodeURIComponent(fileType) +
                '&downloadType=' + encodeURIComponent(downloadType) +
                '&downloadReason=' + encodeURIComponent(downloadReason)) +
                (layers ? '&layers=' + encodeURIComponent(layers) : '') +
                (customHeader ? '&customHeader=' + encodeURIComponent(customHeader) : '') +
                (layersServiceUrl ? '&layersServiceUrl=' + encodeURIComponent(layersServiceUrl) : '');
            return
        }

        if (downloadType === 'records') {
            navigate('/download/confirm?searchParams=' + encodeURIComponent(searchParams || '') +
                '&targetUri=' + encodeURIComponent(targetUri || '') +
                '&filename=' + encodeURIComponent(filename) +
                '&downloadType=' + encodeURIComponent(downloadType) +
                '&downloadReason=' + encodeURIComponent(downloadReason) +
                (layers ? '&layers=' + encodeURIComponent(layers) : '') +
                (customHeader ? '&customHeader=' + encodeURIComponent(customHeader) : '') +
                (layersServiceUrl ? '&layersServiceUrl=' + encodeURIComponent(layersServiceUrl) : ''),
                { state: { fromNavigate: true } });
            return;
        }

        if (downloadType === 'checklist') {
            navigate('/download/confirm?searchParams=' + encodeURIComponent(searchParams || '') +
                '&targetUri=' + encodeURIComponent(targetUri || '') +
                '&filename=' + encodeURIComponent(filenameChecklist) +
                '&downloadType=' + encodeURIComponent(downloadType) +
                '&downloadReason=' + encodeURIComponent(downloadReason),
                { state: { fromNavigate: true } });
            return;
        }

        if (downloadType === 'fieldguide') {
            navigate('/download/confirm?searchParams=' + encodeURIComponent(searchParams || '') +
                '&targetUri=' + encodeURIComponent(targetUri || '') +
                '&filename=' + encodeURIComponent(filenameFieldguide) +
                '&downloadFormat=' + encodeURIComponent(downloadFormat) +
                '&downloadType=' + encodeURIComponent(downloadType) +
                '&downloadReason=' + encodeURIComponent(downloadReason),
                { state: { fromNavigate: true } });
            return;
        }
    }

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
                    <div className='col-md-10 col-md-offset-1'>
                        <h2 className='heading-medium'>
                            <FormattedMessage id='download.download.title' defaultMessage='ALA Data Download' />
                        </h2>

                        {/*This is where static downloads URL would be shown, if it existed*/}
                        {totalRecords && totalRecords > maxRecords && (
                            <div className='alert alert-info' role='alert'>
                                <FormattedMessage id='download.show.long.time.warning' defaultMessage='Your search returned {totalRecords} results and may take some time to run.' values={{ totalRecords: totalRecords }} />
                            </div>
                        )}

                        <div className='well'>
                            <div id='grid-view' className='row'>
                                <div className='col-md-12'>
                                    <div className='comment-wrapper push'>
                                        <div className='row '>
                                            <div className='col-md-2'>
                                                <h4 className='heading-medium-alt'>
                                                    <FormattedMessage id='download.step1' />
                                                </h4>
                                            </div>

                                            <div className='col-md-10'>
                                                <p>
                                                    <FormattedMessage id='download.select.download.type' />
                                                </p>
                                            </div>
                                        </div>

                                        {/*record download options*/}
                                        <div className='row mt-4'>
                                            <div className='col-md-2'>
                                                <FontAwesomeIconLite icon={faTable} style={{color: '#FFBF47', fontSize: '64px'}}/>
                                            </div>
                                            <div className='col-md-7'>
                                                <h4 className='text-uppercase=heading-underlined'>
                                                    <FormattedMessage id='download.occurrence.records' />
                                                </h4>
                                                <p>
                                                    <FormattedMessage id='download.occurrence.records.zip' />
                                                </p>
                                                <form className={`form-horizontal collapse-section${downloadType === 'records' ? ' open' : ''}`} style={{ maxHeight: downloadType != 'records' ? '0' : '200px' }}>
                                                    <div className='mb-3 row'>
                                                        <label htmlFor='file' className='col-sm-4 col-form-label text-end'>
                                                            <FormattedMessage id='download.occurrence.records.filename' />
                                                        </label>
                                                        <div className='col-sm-8'>
                                                            <input type='text' id='file' name='file' value={filename} className='form-control'
                                                                onChange={e => setFilename(e.target.value)} />
                                                        </div>
                                                    </div>

                                                    <div className='mb-3 row'>
                                                        <label htmlFor='downloadFormat' className='col-sm-4 col-form-label text-end'>
                                                            <span className='color--mellow-red' style={{ fontSize: '14px' }}>
                                                                *{' '}
                                                            </span>
                                                            <FormattedMessage id='download.occurrence.records.download.format' />
                                                        </label>
                                                        <div className='col-sm-8 radio'>
                                                            {downloadFormats.map(df => (
                                                                <div>
                                                                    <label style={{ paddingLeft: '0px' }}>
                                                                        <input type='radio' name='downloadFormat' id={`downloadFormat-${df}`} value={downloadFormat} checked={downloadFormat === df} onChange={() => setDownloadFormat(df)} /> <FormattedMessage id={`format.${df}`} />{' '}
                                                                        <RolloverTooltip html={intl.formatMessage({id: `helpicon.${df}`, defaultMessage: ''})} hideDelay={1000}>
                                                                            <FontAwesomeIconLite icon={faQuestionCircle} />
                                                                        </RolloverTooltip>
                                                                    </label>
                                                                </div>
                                                            ))}
                                                            <p className='help-block collapse'>
                                                                <strong>
                                                                    <FormattedMessage id='download.field.mandatory' />
                                                                </strong>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className='mb-3 row'>
                                                        <label className='control-label col-sm-4 text-end'>
                                                            <span className='color--mellow-red' style={{ fontSize: '14px' }}>
                                                                *{' '}
                                                            </span>
                                                            <FormattedMessage id='download.occurrence.records.output.format' />
                                                        </label>
                                                        <div className='col-sm-8 radio'>
                                                            {fileTypes.map(ft => (
                                                                <div>
                                                                    <label style={{ paddingLeft: '0px' }}>
                                                                        <input type='radio' name='fileType' id={`fileType-${ft}`} value={fileType} checked={fileType === ft} onChange={() => setFileType(ft)} /> <FormattedMessage id={`type.${ft}`} />{' '}
                                                                        <RolloverTooltip html={intl.formatMessage({id: `helpicon.${ft}`, defaultMessage: ''})}
                                                                            hideDelay={1000}>
                                                                            <FontAwesomeIconLite icon={faQuestionCircle} />
                                                                        </RolloverTooltip>
                                                                    </label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </form>
                                            </div>

                                            <div className='col-md-3'>
                                                <button className={'btn w-100 option-btn ' + (downloadType == 'records' ? 'btn-success' : 'btn-white')} onClick={() => setDownloadType('records')}>
                                                    {downloadType == 'records' ? (
                                                        <>
                                                            <FontAwesomeIconLite icon={faCheck} /> <FormattedMessage id='download.selected' />
                                                        </>
                                                    ) : (
                                                        <FormattedMessage id='download.select' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/*checklist download option*/}
                                        <div className='row mt-4'>
                                            <div className='col-md-2'>
                                                <FontAwesomeIconLite icon={faListAlt} style={{color: '#65B044', fontSize: '64px'}}/>
                                            </div>
                                            <div className='col-md-7'>
                                                <h4 className='text-uppercase=heading-underlined'>
                                                    <FormattedMessage id='download.species.checklist' />
                                                </h4>
                                                <p>
                                                    <FormattedMessage id='download.species.checklist.text' />
                                                </p>
                                                <form className={`form-horizontal collapse-section${downloadType === 'checklist' ? ' open' : ''}`}>
                                                    <div className='mb-3 row'>
                                                        <label htmlFor='file' className='col-sm-4 col-form-label text-end'>
                                                            <FormattedMessage id='download.occurrence.records.filename' />
                                                        </label>
                                                        <div className='col-sm-8'>
                                                            <input type='text' id='fileChecklist' name='fileChecklist' value={filenameChecklist} className='form-control'
                                                                   onChange={e => setFilenameChecklist(e.target.value)} />
                                                        </div>
                                                    </div>
                                                </form>
                                            </div>

                                            <div className='col-md-3'>
                                                <button className={'btn w-100 option-btn ' + (downloadType == 'checklist' ? 'btn-success' : 'btn-white')} onClick={() => setDownloadType('checklist')}>
                                                    {downloadType == 'checklist' ? (
                                                        <>
                                                            <FontAwesomeIconLite icon={faCheck} /> <FormattedMessage id='download.selected' />
                                                        </>
                                                    ) : (
                                                        <FormattedMessage id='download.select' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/*fieldguide download option*/}
                                        <div className='row mt-4'>
                                            <div className='col-md-2'>
                                                <FontAwesomeIconLite icon={faFilePdf} style={{color: '#DF3034', fontSize: '64px'}}/>
                                            </div>
                                            <div className='col-md-7'>
                                                <h4 className='text-uppercase=heading-underlined'>
                                                    <FormattedMessage id='download.species.field.guide' />
                                                </h4>
                                                <p>
                                                    <FormattedMessage id='download.species.field.guide.text' />
                                                </p>
                                                <form className={`form-horizontal collapse-section${downloadType === 'fieldguide' ? ' open' : ''}`}>
                                                    <div className='mb-3 row'>
                                                        <label htmlFor='file' className='col-sm-4 col-form-label text-end'>
                                                            <FormattedMessage id='download.occurrence.records.filename' />
                                                        </label>
                                                        <div className='col-sm-8'>
                                                            <input type='text' id='fileFieldguide' name='fileFieldguide' value={filenameFieldguide} className='form-control'
                                                                   onChange={e => setFilenameFieldguide(e.target.value)} />
                                                        </div>
                                                    </div>
                                                </form>
                                            </div>

                                            <div className='col-md-3'>
                                                <button className={'btn w-100 option-btn ' + (downloadType == 'fieldguide' ? 'btn-success' : 'btn-white')} onClick={() => setDownloadType('fieldguide')}>
                                                    {downloadType == 'fieldguide' ? (
                                                        <>
                                                            <FontAwesomeIconLite icon={faCheck} /> <FormattedMessage id='download.selected' />
                                                        </>
                                                    ) : (
                                                        <FormattedMessage id='download.select' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='well'>
                            <div className='row'>
                                <div className='col-md-12'>
                                    <div className='comment-wrapper push'>
                                        <div className='row'>
                                            <div className='col-md-2'>
                                                <h4 className='heading-medium-alt'>
                                                    <FormattedMessage id='download.step2' />
                                                </h4>
                                            </div>

                                            <div className='col-md-10'>
                                                <p>
                                                    <FormattedMessage id='download.select.reason.type' />
                                                </p>
                                            </div>
                                        </div>

                                        <div className='row'>
                                            <div className='col-md-2 mt-3'>
                                                <FontAwesomeIconLite icon={faTags} style={{ color: '#65B044', fontSize: '64px' }} />
                                            </div>

                                            <div className='col-md-7'>
                                                <form className='form-horizontal mt-4'>
                                                    <div className='mb-3 row'>
                                                        <label htmlFor='downloadReason' className='col-sm-4 col-form-label text-end'>
                                                            <span className='color--mellow-red'>*</span> <FormattedMessage id='download.reason' />
                                                        </label>
                                                        <div className='col-sm-8'>
                                                            <select className='form-control' id='downloadReason' value={downloadReason} onChange={e => setDownloadReason(e.target.value)}>
                                                                <option value='' disabled>
                                                                    <FormattedMessage id='download.reason.placeholder' />
                                                                </option>
                                                                {loggerReasons.map(it => (
                                                                    <option value={it.id}>
                                                                        <FormattedMessage id={`download.reason.type${it.id}`} defaultMessage={it.name} />
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <p className='help-block'>
                                                        <strong>
                                                            <FormattedMessage id='download.field.mandatory' />
                                                        </strong>{' '}
                                                        <FormattedMessage id='download.choose.best.use.type' />
                                                    </p>
                                                </form>
                                            </div>

                                            <div className='col-md-3'>
                                                <button className='btn btn-primary w-100 option-btn mt-4' type='button' disabled={!downloadReason || !downloadType}
                                                    onClick={() => onNext()}>
                                                    <FormattedMessage id='download.next' /> <FontAwesomeIconLite icon={faChevronRight} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='alert alert-info alert-dismissible' role='alert'>
                            <FormattedMessage id='download.termsofusedownload.01.param' values={{ orgNameLong: orgNameLong }} defaultMessage='By downloading this content you are agreeing to use it in accordance with the {orgNameLong}' />
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

export default Download;
