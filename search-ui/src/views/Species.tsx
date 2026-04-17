/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    Breadcrumb,
    FlaggedAlert,
    FontAwesomeIconLite,
    useHashState,
} from '@ala/common-ui';
import {faChevronDown} from "@fortawesome/free-solid-svg-icons";
import DOMPurify from 'dompurify';
import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {TaxonDescription} from '../api/sources/model.ts';
import FormatName from '../components/nameUtils/formatName.tsx';
import ClassificationView from '../components/species/classificationView.tsx';
import DatasetsView from '../components/species/datasetsView.tsx';
import DescriptionView from '../components/species/descriptionView.tsx';
import ImagesView from '../components/species/imagesView.tsx';

import MapView from '../components/species/mapView.tsx';
import NamesView from '../components/species/namesView.tsx';
import ResourcesView from '../components/species/resourcesView.tsx';
import classes from '../components/species/species.module.css';
import '../css/nameFormatting.css';
import StatusView from '../components/species/statusView.tsx';
import TraitsView from '../components/species/traitsView.tsx';
import capitalizeFirstLetter from '../helpers/Capitalise.ts';
import IMAGE_PLACEHOLDER from '../image/missing-image.png';

function Species({setBreadcrumbs, isMobile}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void, isMobile: boolean }) {
    const [tab, setTab] = useHashState('tab', 'map');
    const [result, setResult] = useState<Record<PropertyKey, string | number | any>>({});
    const [descriptions, setDescriptions] = useState<TaxonDescription[]>([]);
    const [dataFetched, setDataFetched] = useState(false);
    const [invasiveStatus, setInvasiveStatus] = useState(false);
    const [mobileToggle, setMobileToggle] = useState<Record<string, boolean>>({});

    let params = useParams();
    const queryPath = params['*'] || '';

    useEffect(() => {
        if (result?.name && result?.commonName) {
            document.title = `${result.name}: ${result.commonName.join(', ')}`;
        }
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Search', href: '/'},
            {
                title: result ? (<FormatName name={result.scientificName} rankId={result.rank}/>) : ('Loading...'),
                href: '',
            }
        ]);
    }, [result]);

    useEffect(() => {
        let request = queryPath ? [queryPath] : []; // needs to be an array for POST API

        // fix external URL sanitization of :// in the path parameter
        request = request.map(item => item.replace(/https?:\/(?!\/)/g, match => match + '/'));

        setDataFetched(false);
        setResult({});
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/species', {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('V2 error: ' + response.status);
            }
        }).then((data) => {
            if (data[0] && data[0] !== null) {
                var sdsStatusValue = false;
                Object.keys(data[0]).map((key) => {
                    if (key.startsWith('sds_')) {
                        sdsStatusValue = true;
                    }
                });
                data[0].sdsStatus = sdsStatusValue;

                var invasiveStatusValue = false;

                if (data[0]?.nativeIntroduced) {
                    var nativeIntroduced = JSON.parse(data[0].nativeIntroduced);
                    Object.keys(nativeIntroduced).map((key) => {
                        if (nativeIntroduced[key].toLowerCase().includes('invasive')) {
                            invasiveStatusValue = true;
                        }
                    });
                }

                setInvasiveStatus(invasiveStatusValue);
                setResult(data[0]);

                // When there is no hero description there will also be no descriptions
                if (!data[0].heroDescription) {
                    setDescriptions([]);
                } else {
                    fetchDescriptions(data[0]?.guid);
                }

                // change the browser URL to the guid if path is different due to the service resolving to the accepted guid
                if (data[0]?.guid && data[0].guid !== queryPath) {
                    window.history.replaceState({}, '', '/species/' + data[0].guid);
                }
            }
        }).catch((_) => {
            setResult({});
            setDescriptions([]);
            setInvasiveStatus(false);
        }).finally(() => {
            setDataFetched(true);
        });
    }, [queryPath]);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    // If no data is found for taxon ID, show an error message
    if (dataFetched && Object.keys(result).length === 0) {
        return <>
            <div className={classes.speciesHeader}>
                <div className="container-lg py-4">
                    <h3 style={{fontWeight: 800, marginTop: '2.5rem'}}>
                        Not found
                    </h3>
                </div>
            </div>
            <div className="container-lg mt-5">
                <span style={{fontSize: '1.125rem', marginTop: '2.5rem', display: 'block'}}>
                    No taxon found for{' '}
                    <code style={{fontSize: '1.125rem'}}>
                        {queryPath}
                    </code>
                </span>
            </div>
        </>;
    }

    if (!result) {
        return <>
            <span>Loading...</span>
        </>
    }

    function fetchDescriptions(lsid: string) {
        // doubly encoded; once for the file name, once for service (e.g. Cloudfront or http-server) that translate the URL encoding to the file name
        var lsidEncoded = encodeURIComponent(encodeURIComponent(lsid));

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + '/' + lsidEncoded.substring(lsidEncoded.length - 2) + '/' + lsidEncoded + '.json'
        ).then((response) => response.json()).then((json) => {
            setDescriptions(json);
        }).catch(() => {
            // This will disable the 'loading' indicator in DescriptionView
            setDescriptions([]);
        });
    }

    function toggle(section: string) {
        setMobileToggle((prevState) => ({
            ...prevState,
            [section]: !prevState[section],
        }));
    }

    function anyExpanded() {
        return Object.values(mobileToggle).some(value => value);
    }

    function toggleExpandAll() {
        let countTrue = Object.values(mobileToggle).filter(value => value).length;
        if (countTrue > 0) {
            // set all to false
            setMobileToggle({});
        } else {
            // set all to true
            setMobileToggle({
                map: true,
                classification: true,
                description: true,
                images: true,
                names: true,
                status: true,
                traits: true,
                datasets: true,
                resources: true,
            });
        }
    }

    return <div className={'speciesPage'} style={{backgroundColor: isMobile ? '#E7E7E7' : '#FFFFFF'}}>
        <div className={classes.speciesHeader + ' container-fluid'} style={{marginTop: '-47px'}}>
            <div style={{
                maxWidth: '1200px',
                marginLeft: 'auto',
                marginRight: 'auto',
                paddingTop: '20px'
            }}>
                <span className={classes.speciesHeaderName}
                      dangerouslySetInnerHTML={{__html: result.nameFormatted || result.name}}/>
            </div>

            <div className="d-flex" style={{
                maxWidth: '1200px',
                marginLeft: 'auto',
                marginRight: 'auto',
                paddingTop: '20px',
                paddingBottom: isMobile ? '15px' : '60px',
            }}>
                <div style={{width: isMobile ? '100%' : '50%'}}>
                    <span className={classes.speciesHeaderRank} style={{marginBottom: '25px'}}>
                        {capitalizeFirstLetter(result.rank) || 'Unknown taxon rank'}{result.speciesGroup && <>, {result.speciesGroup[0]}</>}
                    </span>

                    {result.commonNameSingle &&
                        <span className={classes.speciesHeaderVernacular}>
                            {result.commonNameSingle}
                        </span>
                    }

                    {/* include first 2 IEK names if available */}
                    {result.vernacularData && result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge').map((item: any, idx: number) =>
                        idx < 2 && <span className={classes.speciesHeaderVernacular}
                                         key={idx}>{item.name} in{' '} {item.languageName}</span>
                    )}
                    {result.vernacularData && result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge').length > 0 &&
                        <a className={classes.speciesLink} onClick={(e) => {
                            e.preventDefault();
                            setTab('names');
                            setTimeout(() => {
                                document.getElementById('indigenous-names-heading')?.scrollIntoView({behavior: 'smooth', block: 'start'});
                            }, 50);
                        }}>{result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge').length === 1 ? 'View this Indigenous name' : `View all ${result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge').length} Indigenous names`}</a>
                    }

                    {result.heroDescription && (
                        <span style={{marginTop: '15px'}} className={classes.speciesHeaderDescription}
                              dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(result.heroDescription),}}/>
                    )}
                    {invasiveStatus &&
                        <FlaggedAlert style={{marginTop: '15px'}} className={classes.flaggedAlert} content={<>
                            This species is{' '}
                            <a className={classes.speciesLink}
                               onClick={(e) => {
                                   e.preventDefault();
                                   setTab('status');
                               }}>
                                considered invasive</a>
                            {' '}in some part of Australia and may be of biosecurity concern.
                        </>}
                        />}
                </div>
                {!isMobile && <>
                    <div style={{flexGrow: 1, maxWidth: '50%', marginLeft: 'auto'}}>
                        {result.image && result.image.split(',').map((id: string, idx: number) =>
                                idx == 0 && <div style={{
                                    marginLeft: '20px',
                                    marginRight: '20px',
                                    overflow: 'hidden',
                                    borderRadius: '10px'
                                }} key={idx}>
                                    <a href={import.meta.env.VITE_APP_IMAGE_BASE_URL + '/image/' + id} target="_blank">
                                        <img className={classes.headerImage}
                                             src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id}
                                             alt="species image"
                                             onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER; }}
                                             onMouseOver={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.1)';
                                             }}
                                             onMouseOut={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.0)';
                                             }}
                                        />
                                    </a>
                                </div>
                        )}
                    </div>
                    <div className="col-12 col-md-2 col-lg-2">
                        <div className="d-flex flex-row flex-lg-column" style={{gap: '20px'}}>
                            {result.image && result.image.split(',').map((id: string, idx: number) =>
                                (idx == 1 || idx == 2) &&
                                <div className={classes.headerImageSmall} key={idx}>
                                    <a href={import.meta.env.VITE_APP_IMAGE_BASE_URL + '/image/' + id}
                                       target="_blank">
                                        <img src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id}
                                             alt="species image"
                                             onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER; }}
                                             onMouseOver={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.1)';
                                             }}
                                             onMouseOut={(event) => {
                                                 const target = event.target as HTMLImageElement;
                                                 target.style.transform = 'scale(1.0)';
                                             }}
                                        />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </>}
            </div>
        </div>
        {isMobile && result.image && <div style={{
            gap: '15px',
            paddingLeft: '15px',
            paddingRight: '15px',
            overflowX: 'auto',
            flexWrap: 'nowrap',
            marginBottom: '20px'
        }} className={"d-flex flex-row"}>
            {result.image.split(',').map((id: string) =>
                <img src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image"
                     onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER; }}
                     style={{borderRadius: '10px', height: '150px'}}/>
            )}
        </div>}
        {isMobile && (<div>
            <div className={"text-end"} style={{paddingRight: '15px'}} onClick={() => toggleExpandAll()}>
                { anyExpanded() ? 'Collapse all' : 'Expand all'}{" "}
                <FontAwesomeIconLite icon={faChevronDown}/>
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('map')}>
                    Map
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/></div>
                {mobileToggle['map'] &&
                    <div className={classes.mobileSectionContent}>
                        <MapView result={result} tab={tab} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('classification')}>
                    Classification
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['classification'] &&
                    <div className={classes.mobileSectionContent}>
                        <ClassificationView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('description')}>
                    Description
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['description'] &&
                    <div className={classes.mobileSectionContent}>
                        <DescriptionView descriptions={descriptions} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('images')}>
                    Images and sounds
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['images'] &&
                    <div className={classes.mobileSectionContent}>
                        <ImagesView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('names')}>
                    Names
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['names'] &&
                    <div className={classes.mobileSectionContent}>
                        <NamesView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('status')}>
                    Status
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['status'] &&
                    <div className={classes.mobileSectionContent}>
                        <StatusView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('traits')}>
                    Traits
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['traits'] &&
                    <div className={classes.mobileSectionContent}>
                        <TraitsView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('datasets')}>
                    Datasets
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['datasets'] &&
                    <div className={classes.mobileSectionContent}>
                        <DatasetsView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
            <div className={classes.mobileSection}>
                <div className={classes.mobileSectionTitle} onClick={() => toggle('resources')}>
                    Resources
                    <FontAwesomeIconLite icon={faChevronDown} style={{float: "right"}}/>
                </div>
                {mobileToggle['resources'] &&
                    <div className={classes.mobileSectionContent}>
                        <ResourcesView result={result} isMobile={isMobile}/>
                    </div>
                }
            </div>
        </div>)}
        {!isMobile && <>
            <div style={{borderBottom: '1px solid #D9D9D9'}}>
                <div className="d-flex flex-wrap"
                     style={{maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto'}}>
                    <div className={`${tab === 'map' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('map')}>
                        Map
                    </div>
                    <div className={`${tab === 'classification' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('classification')}>
                        Classification
                    </div>
                    <div className={`${tab === 'description' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('description')}>
                        Description
                    </div>
                    <div className={`${tab === 'media' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('media')}>
                        Images and sounds
                    </div>
                    <div className={`${tab === 'names' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('names')}>
                        Names
                    </div>
                    <div className={`${tab === 'status' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('status')}>
                        Status
                    </div>
                    <div className={`${tab === 'traits' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('traits')}>
                        Traits
                    </div>
                    <div className={`${tab === 'datasets' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('datasets')}>
                        Datasets
                    </div>
                    <div className={`${tab === 'resources' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('resources')}>
                        Resources
                    </div>
                </div>
            </div>
            <div className="container" style={{maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto'}} >
                <div style={{height: '60px'}}/>
                <div style={{display: tab === 'map' ? 'block' : 'none'}}>
                    <MapView result={result} tab={tab} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'classification' ? 'block' : 'none',}}>
                    <ClassificationView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'description' ? 'block' : 'none',}}>
                    <DescriptionView descriptions={descriptions} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'media' ? 'block' : 'none'}}>
                    <ImagesView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'names' ? 'block' : 'none'}}>
                    <NamesView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'status' ? 'block' : 'none'}}>
                    <StatusView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'traits' ? 'block' : 'none'}}>
                    <TraitsView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'datasets' ? 'block' : 'none'}}>
                    <DatasetsView result={result} isMobile={isMobile}/>
                </div>
                <div style={{display: tab === 'resources' ? 'block' : 'none'}}>
                    <ResourcesView result={result} isMobile={isMobile}/>
                </div>
                <div style={{height: '120px'}}/>
            </div>
        </>}
    </div>;
}

export default Species;
