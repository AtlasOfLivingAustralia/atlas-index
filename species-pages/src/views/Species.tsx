/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useQueryState} from "nuqs";
import DOMPurify from "dompurify";

import {Breadcrumb} from "../api/sources/model.ts";
import MapView from "../components/species/mapView.tsx";
import ClassificationView from "../components/species/classificationView.tsx";
import DescriptionView from "../components/species/descriptionView.tsx";
import ImagesView from "../components/species/imagesView.tsx";
import NamesView from "../components/species/namesView.tsx";
import StatusView from "../components/species/statusView.tsx";
import TraitsView from "../components/species/traitsView.tsx";
import DatasetsView from "../components/species/datasetsView.tsx";
import ResourcesView from "../components/species/resourcesView.tsx";
import capitalizeFirstLetter from "../helpers/Capitalise.ts";
import {TaxonDescription} from "../api/sources/model.ts"
import classes from '../components/species/species.module.css';
import '../css/nameFormatting.css';
import FormatName from "../components/nameUtils/formatName.tsx";
import FlaggedAlert from "../components/common-ui/flaggedAlert.tsx";

function Species({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}) {
    const [tab, setTab] = useQueryState('tab', {defaultValue: 'map'});
    const [result, setResult] = useState<Record<PropertyKey, string | number | any>>({});
    const [descriptions, setDescriptions] = useState<TaxonDescription[]>([]);
    const [dataFetched, setDataFetched] = useState(false);
    const [invasiveStatus, setInvasiveStatus] = useState(false);
    let params = useParams();
    const queryPath = params["*"] || '';

    useEffect(() => {
        if (result?.name && result?.commonName) {
            document.title = `${result.name}: ${result.commonName.join(', ')}`;
        }
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Search', href: '/'},
            {title: result ? <FormatName name={result.scientificName} rankId={result.rank}/> : 'Loading...', href: ''},
        ]);
    }, [result]);

    useEffect(() => {
        const request = queryPath ? [queryPath] : []; // needs to be an array for POST API
        setDataFetched(false);
        setResult({});
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/species", {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('V2 error: ' + response.status);
                }
            })
            .then(data => {
                if (data[0] && data[0] !== null) {
                    var sdsStatusValue = false
                    Object.keys(data[0]).map(key => {
                        if (key.startsWith('sds_')) {
                            sdsStatusValue = true;
                        }
                    });
                    data[0].sdsStatus = sdsStatusValue;

                    var invasiveStatusValue = false;

                    if (data[0]?.nativeIntroduced) {
                        var nativeIntroduced = JSON.parse(data[0].nativeIntroduced);
                        Object.keys(nativeIntroduced).map(key => {
                            if (nativeIntroduced[key].toLowerCase().includes('invasive')) {
                                invasiveStatusValue = true;
                            }
                        });
                    }

                    setInvasiveStatus(invasiveStatusValue);
                    setResult(data[0])
                    fetchDescriptions(data[0]?.guid)
                }
            })
            .catch(error => {
                console.warn(error);
            })
            .finally(() => {
                setDataFetched(true);
            });

    }, [queryPath]);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    // If no data is found for taxon ID, show an error message
    if (dataFetched && Object.keys(result).length === 0) {
        return (
            <>
                <div className={classes.speciesHeader}>
                    <div className="container-lg py-4">
                        <h3 style={{fontWeight: 800, marginTop: "2.5rem"}}>
                            Not found
                        </h3>
                    </div>
                </div>
                <div className="container-lg mt-5">
                    <span style={{fontSize: "1.125rem", marginTop: "2.5rem", display: "block"}}>
                      No taxon found for <code style={{fontSize: "1.125rem"}}>{queryPath}</code>
                    </span>
                </div>
            </>
        );
    }

    if (!result) {
        return <>
            <span>Loading...</span>
        </>
    }

    function fetchDescriptions(lsid: string) {
        // doubly encoded; once for the file name, once for service (e.g. Cloudfront or http-server) that translate the URL encoding to the file name
        var lsidEncoded = encodeURIComponent(encodeURIComponent(lsid))

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + "/" + lsidEncoded.substring(lsidEncoded.length - 2) + "/" + lsidEncoded + ".json")
            .then(response => response.json()).then(json => {
            setDescriptions(json)
        }).catch(() => {
            // This will disable the 'loading' indicator in DescriptionView
            setDescriptions([])
        });
    }

    return (
        <div className={"speciesPage"}>
            <div className={classes.speciesHeader + " container-fluid"}>
                <div className="d-flex" style={{
                    maxWidth: "1200px",
                    marginLeft: "auto",
                    marginRight: "auto",
                    paddingTop: "20px",
                    paddingBottom: "60px",
                }}>
                    <div style={{
                        width: "fit-content"
                    }}>
                    <span className={classes.speciesHeaderName}>
                      <FormatName name={result.name} rankId={result.rankID}/>
                    </span>
                        <span className={classes.speciesHeaderRank}
                              style={{marginTop: "5px", marginBottom: "25px"}}>
                        {capitalizeFirstLetter(result.rank) || 'Unknown taxon rank'}</span>

                        {result.commonNameSingle &&
                            <span className={classes.speciesHeaderVernacular}>
                          {result.commonNameSingle}
                        </span>
                        }
                        { /* include first 2 IEK names if available */}
                        {result.vernacularData && result.vernacularData.filter((item: any) => item.status === 'traditionalKnowledge').map((item: any, idx: number) =>
                                idx < 2 &&
                                <span className={classes.speciesHeaderVernacular} key={idx}>
                          {item.name} in {item.languageName}
                        </span>
                        )}
                        <a
                            className={classes.speciesLink}
                            onClick={e => {
                                e.preventDefault();
                                setTab('names');
                            }}
                        >
                            More names
                        </a>

                        {result.heroDescription &&
                            <span
                                style={{marginTop: "15px"}} className={classes.speciesHeaderDescription}
                                dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(result.heroDescription)}}
                            />
                        }
                        {invasiveStatus && <FlaggedAlert content={<>
                            This species is <a className={classes.speciesLink} onClick={e => {
                            e.preventDefault();
                            setTab('status');
                        }}>considered invasive</a> in some part of Australia and may be of biosecurity
                            concern.</>
                        } style={{marginTop: "15px"}}/>}
                    </div>
                    <div
                        style={{
                            flexGrow: 1,
                            maxWidth: "50%",
                            marginLeft: "auto"
                        }}>
                        {result.image && result.image.split(',').map((id: string, idx: number) =>
                            idx == 0 &&
                            <div style={{marginLeft: "20px", marginRight: "20px"}} key={idx}>
                                <img className={classes.headerImage}
                                     src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id}
                                     alt="species image"/>
                            </div>
                        )}
                    </div>
                    {/*<div className="col-12 col-md-2 col-lg-2" >*/}
                    {/*    <div className="d-flex gap-3 flex-row flex-lg-column">*/}
                    {/*        {result.image && result.image.split(',').map((id: string, idx: number) =>*/}
                    {/*            idx == 0 &&*/}
                    {/*            <div style={{marginLeft: "8px", marginRight: "8px"}} key={idx}>*/}
                    {/*                <img src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image" />*/}
                    {/*            </div>*/}
                    {/*        )}*/}
                    {/*        {result.image && result.image.split(',').map((id: string, idx: number) =>*/}
                    {/*            idx == 0 &&*/}
                    {/*            <div style={{marginLeft: "8px", marginRight: "8px"}} key={idx}>*/}
                    {/*                <img src={import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL + id} alt="species image" />*/}
                    {/*            </div>*/}
                    {/*        )}*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                </div>
            </div>
            <div>
                <div className="d-flex justify-content-center flex-wrap"
                     style={{
                         backgroundColor: "#FFFFFF",
                         marginLeft: "-15px",
                         marginRight: "-15px",
                         borderBottom: "1px solid #D9D9D9"
                     }}>
                    <div className={`${tab === 'map' ? classes.activeTab : ''} ${classes.tabButtons}`}
                         onClick={() => handleTabChange('map')}>
                        Occurrence map
                    </div>
                    <div
                        className={`${tab === 'classification' ? classes.activeTab : ''} ${classes.tabButtons}`}
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
                    <div
                        className={`${tab === 'status' ? classes.activeTab : ''} ${classes.tabButtons}`}
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
            <div className="container-lg">
                <div style={{height: "60px"}}/>
                <div style={{display: tab === 'map' ? 'block' : 'none'}}>
                    <MapView result={result} tab={tab}/>
                </div>
                <div style={{display: tab === 'classification' ? 'block' : 'none'}}>
                    <ClassificationView result={result}/>
                </div>
                <div style={{display: tab === 'description' ? 'block' : 'none'}}>
                    <DescriptionView descriptions={descriptions}/>
                </div>
                <div style={{display: tab === 'media' ? 'block' : 'none'}}>
                    <ImagesView result={result}/>
                </div>
                <div style={{display: tab === 'names' ? 'block' : 'none'}}>
                    <NamesView result={result}/>
                </div>
                <div style={{display: tab === 'status' ? 'block' : 'none'}}>
                    <StatusView result={result}/>
                </div>
                <div style={{display: tab === 'traits' ? 'block' : 'none'}}>
                    <TraitsView result={result}/>
                </div>
                <div style={{display: tab === 'datasets' ? 'block' : 'none'}}>
                    <DatasetsView result={result}/>
                </div>
                <div style={{display: tab === 'resources' ? 'block' : 'none'}}>
                    <ResourcesView result={result}/>
                </div>
                <div style={{height: "120px"}}/>
            </div>
        </div>
    );
}

export default Species;
