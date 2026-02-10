import { FontAwesomeIconLite } from '@ala/common-ui';
import { faBan, faCheckCircle, faEnvelope, faExclamationCircle, faFlag, faQuestionCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import { Circle, LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ReactLeafletGoogleLayer from 'react-leaflet-google-layer';
import { RecordResult } from '../../api/model.tsx';
import ContactCuratorModal from '../contactCuratorModal.tsx';
import RolloverTooltip from '../rolloverTooltip.tsx';

// TODO: move to config
const skin_useAlaImageService = true;
const defaultZoom = 5;

function RecordSidebar({ record, contacts, userAssertions, eventHierarchy }: { record?: RecordResult; contacts?: any; userAssertions?: any; eventHierarchy?: any }) {
    const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
    const [showContactsModal, setShowContactsModal] = useState(false);

    const intl: IntlShape = useIntl();

    useEffect(() => {
        if (record && record?.processed?.location?.decimalLatitude && record?.processed?.location?.decimalLongitude) {
            setLatLng({lat: record.processed.location.decimalLatitude, lng: record.processed.location.decimalLongitude});
        }
    }, [record]);

    function RenderTree({ eventHierarchy }: { eventHierarchy: string[] }) {
        function renderNode(hierarchy: string[]): React.ReactNode {
            if (!hierarchy || hierarchy.length === 0) return null;
            const nodeLabel = hierarchy[0];
            const nodeClass = hierarchy.length === 1 ? 'selected' : '';
            return (
                <ul className='tree'>
                    <li>
                        <span className={nodeClass}>{nodeLabel}</span>
                        {hierarchy.length > 1 && renderNode(hierarchy.slice(1))}
                    </li>
                </ul>
            );
        }
        return <>{renderNode(eventHierarchy)}</>;
    }

    function sanitize(input: string): string {
        console.log("TODO: sanitize input");
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    if (!record) {
        return null;
    }

    return (
        <>
            <button
                className='btn btn-default'
                id='assertionButton'
                role='button'
                data-toggle='modal'
                title='report a problem or suggest a correction for this record'
                onClick={() => {alert('TODO: flag an issue dialog');}}>
                <FontAwesomeIcon icon={faFlag} /> <FormattedMessage id='show.button.assertionbutton.span' defaultMessage='Flag an issue' />
            </button>

            {contacts && contacts.length > 0 && (
                <button
                    className='btn btn-default'
                    id='showCurator'
                    role='button'
                    data-toggle='modal'
                    title='Contact curator for more details on a record'
                    onClick={() => setShowContactsModal(true)}
                    style={{marginLeft: '5px'}}>
                    <FontAwesomeIcon icon={faEnvelope} /> <FormattedMessage id='show.showcontactcurator.span' defaultMessage='Contact curator' />
                </button>
            )}

            <div className=''>
                <ul id='navBox' className='nav nav-pills nav-stacked flex-column' style={{marginBottom: '10px'}}>
                    <li className='nav-item'>
                        <a href='#occurrenceDataset'>
                            <FormattedMessage id='recordcore.occurencedataset.title' defaultMessage='Dataset' />
                        </a>
                    </li>
                    <li>
                        <a href='#occurrenceEvent'>
                            <FormattedMessage id='recordcore.occurenceevent.title' defaultMessage='Event' />
                        </a>
                    </li>
                    <li>
                        <a href='#occurrenceTaxonomy'>
                            <FormattedMessage id='recordcore.occurencetaxonomy.title' defaultMessage='Taxonomy' />
                        </a>
                    </li>
                    <li>
                        <a href='#occurrenceGeospatial'>
                            <FormattedMessage id='recordcore.occurencegeospatial.title' defaultMessage='Geospatial' />
                        </a>
                    </li>
                    {record?.raw?.miscProperties && Object.keys(record.raw.miscProperties).length > 0 && (
                        <li>
                            <a href='#additionalProperties'>
                                <FormattedMessage id='recordcore.div.addtionalproperties.title' defaultMessage='Additional properties' />
                            </a>
                        </li>
                    )}
                    {record?.images && record.images.length > 0 && (
                        <li>
                            <a href='#images'>
                                <FormattedMessage id='show.sidebar03.title' defaultMessage='Images' />
                            </a>
                        </li>
                    )}
                    {record?.sounds && record.sounds.length > 0 && (
                        <li>
                            <a href='#sounds'>
                                <FormattedMessage id='show.soundsheader.title' defaultMessage='Sounds' />
                            </a>
                        </li>
                    )}
                    {userAssertions && (
                        <li>
                            <a href='#userAnnotationsDiv' id='userAnnotationsNav' style={{ display: 'none' }}>
                                <FormattedMessage id='show.userannotationsdiv.title' defaultMessage='User flagged issues' />
                            </a>
                        </li>
                    )}
                    {record?.referencedPublications && record.referencedPublications.length > 0 && (
                        <li>
                            <a href='#referencedPublications'>
                                <FormattedMessage id='show.referencedPublications.title' defaultMessage='Referenced in publications' /> ({record.referencedPublications.length})
                            </a>
                        </li>
                    )}

                    {record.systemAssertions && record.processed?.attribution?.provenance !== 'Draft' && (
                        <li>
                            <a href='#dataQuality'>
                                <FormattedMessage id='show.dataquality.title' defaultMessage='Data quality tests' /> ({record.systemAssertions.failed?.length || 0}{' '}
                                <RolloverTooltip text={intl.formatMessage({ id: 'assertions.failed', defaultMessage: 'failed' })}>
                                    <FontAwesomeIconLite icon={faTimesCircle} style={{ color: 'red' }} title=' failed' />
                                </RolloverTooltip>
                                , {record.systemAssertions.warning?.length || 0}{' '}
                                <RolloverTooltip text={intl.formatMessage({ id: 'assertions.warnings', defaultMessage: 'warnings' })}>
                                    <FontAwesomeIconLite icon={faExclamationCircle} style={{ color: 'orange' }} title=' warning' />
                                </RolloverTooltip>
                                , {record.systemAssertions.passed?.length || 0}{' '}
                                <RolloverTooltip text={intl.formatMessage({ id: 'assertions.passed', defaultMessage: 'passed' })}>
                                    <FontAwesomeIconLite icon={faCheckCircle} style={{ color: 'green' }} title=' passed' />
                                </RolloverTooltip>
                                , {record.systemAssertions.missing?.length || 0}{' '}
                                <RolloverTooltip text={intl.formatMessage({ id: 'assertions.missing', defaultMessage: 'missing' })}>
                                    <FontAwesomeIconLite icon={faQuestionCircle} style={{ color: 'gray' }} title=' missing' />
                                </RolloverTooltip>
                                , {record.systemAssertions.unchecked?.length || 0}{' '}
                                <RolloverTooltip text={intl.formatMessage({ id: 'assertions.unchecked', defaultMessage: 'unchecked' })}>
                                    <FontAwesomeIconLite icon={faBan} style={{ color: 'gray' }} title=' unchecked' />
                                </RolloverTooltip>
                                )
                            </a>
                        </li>
                    )}

                    {record?.processed?.occurrence?.outlierForLayers && record?.processed?.occurrence?.outlierForLayers?.length > 0 && (
                        <li>
                            <a href='#outlierInformation'>
                                <FormattedMessage id='show.outlierinformation.title' defaultMessage='Outlier information' />
                            </a>
                        </li>
                    )}

                    {record?.processed?.occurrence?.duplicationStatus && record.processed.occurrence.duplicationStatus.length > 0 && (
                        <li>
                            <a href='#inferredOccurrenceDetails'>
                                <FormattedMessage id='show.inferredoccurrencedetails.title' defaultMessage='Inferred associated occurrence details' />
                            </a>
                        </li>
                    )}

                    {record?.processed?.cl && Object.keys(record.processed.cl).length > 0 && (
                        <li>
                            <a href='#contextualSampleInfo'>
                                <FormattedMessage id='show.outlierinformation.02.title01' defaultMessage='Additional political boundaries information' />
                            </a>
                        </li>
                    )}

                    {record?.processed?.el && Object.keys(record.processed.el).length > 0 && (
                        <li>
                            <a href='#environmentalSampleInfo'>
                                <FormattedMessage id='show.outlierinformation.02.title02' defaultMessage='Environmental sampling for this location' />
                            </a>
                        </li>
                    )}
                </ul>
            </div>

            {record?.processed?.attribution?.provenance && record.processed.attribution.provenance === 'Draft' && (
                <div className='sidebar'>
                    <p className='grey-bg' style={{ padding: '5px', marginTop: '15px', marginBottom: '10px' }}>
                        <FormattedMessage id='show.sidebar01.p' defaultMessage='This record was transcribed from the label by an online volunteer. It has not yet been validated by the owner institution' />
                        <a href='https://volunteer.ala.org.au/'>
                            <FormattedMessage id='show.sidebar01.volunteer.navigator' defaultMessage='Biodiversity Volunteer Portal' />
                        </a>
                        .
                    </p>
                </div>
            )}

            {latLng && (
                <div id='leafletMap' style={{ height: '300px', position: 'relative' }}>
                    <MapContainer center={latLng} zoom={defaultZoom} scrollWheelZoom={false} worldCopyJump={true} style={{ height: '300px' }}>
                        {!import.meta.env.VITE_GOOGLE_MAP_API_KEY && <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />}
                        {import.meta.env.VITE_GOOGLE_MAP_API_KEY && (
                            <LayersControl position='topright'>
                                <LayersControl.BaseLayer checked name='Minimal'>
                                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_OPENSTREETMAP_ZXY_URL} zIndex={1} />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name='Road'>
                                    <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'roadmap'} />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name='Terrain'>
                                    <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'terrain'} />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name='Satellite'>
                                    <ReactLeafletGoogleLayer apiKey={import.meta.env.VITE_GOOGLE_MAP_API_KEY} type={'satellite'} />
                                </LayersControl.BaseLayer>
                            </LayersControl>
                        )}

                        <Marker position={latLng} />

                        {record?.processed?.location?.coordinateUncertaintyInMeters && latLng && !isNaN(Number(record.processed.location.coordinateUncertaintyInMeters)) && (
                            <Circle
                                center={latLng}
                                radius={Number(record.processed.location.coordinateUncertaintyInMeters)}
                                pathOptions={{
                                    stroke: true,
                                    weight: 2,
                                    color: 'black',
                                    opacity: 0.2,
                                    fillColor: '#888',
                                    fillOpacity: 0.2
                                }}
                            />
                        )}
                    </MapContainer>
                </div>
            )}

            {eventHierarchy && record?.raw?.event?.eventID && (
                <div id='eventDetailsSideBar' className='well well-sm' style={{ marginTop: '20px' }}>
                    <h4>
                        <FormattedMessage id='record.eventdetails.label' />
                    </h4>
                    <p>
                        <FormattedMessage id='record.eventdetails.desc1' />
                        <div>{RenderTree({ eventHierarchy })}</div>
                        <FormattedMessage id='record.eventdetails.desc2' />
                        <br />
                        <a className='btn-small btn btn-default' style={{ marginTop: '10px' }} href={`${import.meta.env.VITE_APP_EVENTS_HIERARCHY_URL}${record.raw.event.eventID}`}>
                            <FormattedMessage id='record.eventdetails.link' />
                        </a>
                    </p>
                </div>
            )}

            {record?.images && record.images.length > 0 && (
                <div className='sidebar'>
                    <h3 id='images'>
                        <FormattedMessage id='show.sidebar03.title' defaultMessage='Images' />
                    </h3>
                    <div id='occurrenceImages' style={{ marginTop: '5px' }}>
                        {record.images.map((image, index: number) => (
                            <div style={{ marginBottom: '10px' }} key={index}>
                                {skin_useAlaImageService ? (
                                    <a href={`${import.meta.env.VITE_APP_IMAGE_VIEWER_URL}${image.filePath}`} target='_blank'>
                                        <img src={image.alternativeFormats?.smallImageUrl} style={{ maxWidth: '100%' }} alt='Click to view this image in a large viewer' />
                                    </a>
                                ) : (
                                    <a href={`${image.alternativeFormats?.largeImageUrl}`} target='_blank'>
                                        <img src={`${image.alternativeFormats?.smallImageUrl}`} style={{ maxWidth: '100%' }} />
                                    </a>
                                )}
                                <br />

                                {/* record.raw.miscProperties?.TITLE no longer required as the one data resource it was added for no longer has this field */}

                                {(record?.raw?.occurrence?.photographer || image?.metadata?.creator) && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.cite01' defaultMessage='Photographer' />:
                                            </b>{' '}
                                            {image?.metadata?.creator || record?.raw?.occurrence?.photographer}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {(record?.raw?.occurrence?.rights || image?.metadata?.rights) && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.cite02' defaultMessage='Rights' />:
                                            </b>{' '}
                                            ${image?.metadata?.rights || record?.raw?.occurrence?.rights}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {(record?.raw?.occurrence?.rightsholder || image?.metadata?.rightsHolder) && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.cite03' defaultMessage='Rights holder' />:
                                            </b>{' '}
                                            {image?.metadata?.rightsHolder || record?.raw?.occurrence?.rightsholder}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {record?.raw?.miscProperties?.rightsHolder && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.cite03' defaultMessage='Rights holder' />:
                                            </b>{' '}
                                            {record.raw.miscProperties.rightsHolder}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {image.metadata?.license && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.image.license' defaultMessage='License' />:
                                            </b>{' '}
                                            {image.metadata?.license}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {record?.raw?.miscProperties && record?.raw?.miscProperties['DESCRIPTION'] && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.caption' defaultMessage='Caption' />:
                                            </b>{' '}
                                            {sanitize(record.raw.miscProperties.DESCRIPTION)}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {skin_useAlaImageService ? (
                                    <a href={`${import.meta.env.VITE_APP_IMAGE_METADATA_URL}${image.filePath}`} target='_blank'>
                                        <FormattedMessage id='show.sidebardiv.occurrenceimages.navigator01' defaultMessage='View image details' />
                                    </a>
                                ) : (
                                    <a href={image.alternativeFormats?.imageUrl} target='_blank'>
                                        <FormattedMessage id='show.sidebardiv.occurrenceimages.navigator02' defaultMessage='Original image' />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {record?.sounds && record.sounds.length > 0 && (
                <div className='sidebar'>
                    <h3 id='soundsHeader' style={{ margin: '20px 0 0 0' }}>
                        <FormattedMessage id='show.soundsheader.title' defaultMessage='Sounds' />
                    </h3>
                    <div id='occurrenceSounds' style={{ marginTop: '5px' }}>
                        {record.sounds.map((sound: any, index: number) => (
                            <React.Fragment key={index}>
                                <div className='row'>
                                    <div id='audioWrapper' className='col-md-12'>
                                        <audio src={sound?.alternativeFormats ? sound?.alternativeFormats['audio/mpeg'] : ''} preload='auto' controls />
                                        <div className='track-details'>{record?.raw?.classification?.scientificName}</div>
                                    </div>
                                </div>
                                <p>
                                    <FormattedMessage id='show.sidebar04.p' defaultMessage='Please press the play button to hear the sound file associated with this occurrence record.' />
                                </p>

                                {(sound?.metadata?.rights || record?.raw?.occurrence?.rights) && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar04.cite' defaultMessage='Rights' />:
                                            </b>{' '}
                                            {sound?.metadata?.rights || record?.raw?.occurrence?.rights}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {(sound?.metadata?.rightsHolder || record?.raw?.occurrence?.rightsholder) && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.cite03' defaultMessage='Rights holder' />:
                                            </b>{' '}
                                            {sound?.metadata?.rightsHolder || record?.raw?.occurrence?.rightsholder}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {sound?.metadata?.license && (
                                    <>
                                        <cite>
                                            <b>
                                                <FormattedMessage id='show.sidebar03.sound.license' defaultMessage='License' />:
                                            </b>{' '}
                                            {sound?.metadata?.license}
                                        </cite>
                                        <br />
                                    </>
                                )}

                                {skin_useAlaImageService && sound?.alternativeFormats?.detailLink && (
                                    <>
                                        <a href={sound?.alternativeFormats?.detailLink} target='_blank'>
                                            <FormattedMessage id='show.sidebardiv.occurrencesounds.navigator01' defaultMessage='View sound details' />
                                        </a>
                                        <br />
                                    </>
                                )}
                                <br />
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {record?.raw?.lastModifiedTime && record?.processed?.lastModifiedTime && (
                <div className='sidebar'>
                    <p style={{ marginBottom: '20px', marginTop: '20px' }}>
                        <FormattedMessage id='show.sidebar05.p01' defaultMessage='Date loaded' />: {record.raw.lastModifiedTime.substring(0, 10)}
                        <br />
                        <FormattedMessage id='show.sidebar05.p02' defaultMessage='Date last processed' />: {record.processed.lastModifiedTime.substring(0, 10)}
                        <br />
                    </p>
                </div>
            )}

            {/*TODO: dialog for flagging an issue*/}

            {showContactsModal && contacts && <ContactCuratorModal contacts={contacts} onClose={() => setShowContactsModal(false)} />}
        </>
    );
}

export default RecordSidebar;
