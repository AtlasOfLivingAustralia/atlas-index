/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import classes from "../components/search/search.module.css";
import AllView from "../components/search/allView.tsx";
import GenericView from "../components/search/genericView.tsx";
import {datasetsDefn} from "../components/search/props/datasetsDefn.tsx";
import {speciesDefn} from "../components/search/props/speciesDefn.tsx";
import {specieslistDefn} from "../components/search/props/specieslistDefn.tsx";
import {dataprojectsDefn} from "../components/search/props/dataprojectsDefn.tsx";
import {environmentallayersDefn} from "../components/search/props/environmentallayersDefn.tsx";
import {regionslocalitiesDefn} from "../components/search/props/regionslocalitiesDefn.tsx";
import {wordpressDefn} from "../components/search/props/wordpressDefn.tsx";
import {supportDefn} from "../components/search/props/supportDefn.tsx";
import FontAwesomeIcon from '../components/common-ui/fontAwesomeIconLite.tsx'
import {faTimes} from '@fortawesome/free-solid-svg-icons/faTimes';
import {faSearch} from '@fortawesome/free-solid-svg-icons';
import {useHeight} from "../components/common-ui/useHeight.tsx";
import {useQueryState} from "nuqs";
import useHashState from "../components/common-ui/util/useHashState.tsx";

const MOBILE_BREAKPOINT = 768; // Define the breakpoint for mobile view

function Search({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {
    const [searchInputText, setSearchInputText] = useState<string>('');
    const [query, setQuery] = useQueryState('q')
    const [tab, setTab] = useHashState('tab', 'all');
    const contentRef = useRef(null);
    const height = useHeight(contentRef); // Get the measured height
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Search', href: '/'}
        ]);

        setSearchInputText(query || '')

        const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    const updateQuery = (query: string) => {
        setSearchInputText(query);
        setQuery(query);
    };

    return (
        <>
            <div className="container-fluid" style={{marginTop: isMobile ? "0px" : "-47px"}}>
                <div style={{backgroundColor: "#E7E7E7", marginLeft: "-15px", marginRight: "-15px"}}
                     className={classes.headerLogo}>
                    <div className="d-flex justify-content-center">
                        <span className={classes.searchTitle}>Search Atlas of Living Australia</span>
                    </div>
                    <div className={"d-flex justify-content-center " + classes.searchContainer}>
                        <input placeholder="Search species, datasets, content and more..."
                               className={classes.searchInput}
                               value={searchInputText}
                               onChange={(event) => setSearchInputText(event.currentTarget.value)}
                               onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                                   if (event.key === 'Enter') {
                                       setSearchInputText(event.currentTarget.value);
                                       setQuery(event.currentTarget.value);
                                       event.preventDefault();
                                   }
                               }}
                        />
                        <div style={{marginLeft: "-14px", marginTop: "12px", zIndex: "100", cursor: "pointer"}}>
                            <button
                                type="button"
                                className="btn btn-link p-0"
                                style={{marginLeft: "-30px", color: "black"}}
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearchInputText("");
                                    setQuery("");
                                }}
                            >
                                <FontAwesomeIcon icon={faTimes}/>
                            </button>
                        </div>
                        <button className={classes.searchButton}
                                onClick={() => setQuery(searchInputText)}>
                            <FontAwesomeIcon icon={faSearch}/>
                        </button>
                    </div>
                    {isMobile &&
                        <div className={"d-flex justify-content-center "}>
                            <select className={"form-select " + classes.mobileSelect}
                                value={tab}
                                onChange={(event) => {handleTabChange(event.target.value);}}>
                                <option value="all">All</option>
                                <option value="dataprojects">Data projects</option>
                                <option value="datasets">Datasets</option>
                                <option value="alageneralcontent">General content</option>
                                <option value="helparticles">Help articles</option>
                                <option value="regionslocalities">Locations</option>
                                <option value="environmentallayers">Spatial layers</option>
                                <option value="species">Species</option>
                                <option value="specieslists">Species lists</option>
                            </select>
                        </div>
                    }
                </div>
                {!isMobile &&
                    <div className="d-flex justify-content-center flex-wrap"
                         style={{backgroundColor: "#FFFFFF", marginLeft: "-15px", marginRight: "-15px", borderBottom: "1px solid #D9D9D9"}}>
                        <div className={`${tab === 'all' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('all')}>
                            {/*<AllIcon/>*/}
                            All
                        </div>
                        <div className={`${tab === 'species' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('species')}>
                            {/*<SpeciesIcon/>*/}
                            Species
                        </div>
                        <div className={`${tab === 'datasets' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('datasets')}>
                            {/*<DatasetsIcon/>*/}
                            Datasets
                        </div>
                        <div className={`${tab === 'specieslists' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('specieslists')}>
                            {/*<SpeciesListsIcon/>*/}
                            Species lists
                        </div>
                        <div className={`${tab === 'dataprojects' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('dataprojects')}>
                            {/*<DataProjectsIcon/>*/}
                            Data projects
                        </div>
                        <div
                            className={`${tab === 'environmentallayers' ? classes.activeTab : ''} ${classes.tabButtons}`}
                            onClick={() => handleTabChange('environmentallayers')}>
                            {/*<SpatialLayersIcon/>*/}
                            Spatial layers
                        </div>
                        <div className={`${tab === 'regionslocalities' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('regionslocalities')}>
                            {/*<RegionsIcon/>*/}
                            Locations
                        </div>
                        <div className={`${tab === 'alageneralcontent' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('alageneralcontent')}>
                            {/*<GeneralContentIcon/>*/}
                            General content
                        </div>
                        <div className={`${tab === 'helparticles' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('helparticles')}>
                            {/*<HelpArticlesIcon/>*/}
                            Help articles
                        </div>
                    </div>
                }
                <div className="container" style={{
                    maxWidth: "1280px",
                    height: `${height}px`, overflow: 'hidden', transition: 'height 0.5s ease-in-out',
                    minHeight: "500px"
                }}>
                    <div ref={contentRef}>
                        <div style={{height: "30px"}}/>
                        {tab === 'all' && <AllView queryString={query} setQuery={updateQuery} setTab={setTab} isMobile={isMobile}/>}
                        {tab === 'species' && <GenericView queryString={query} props={speciesDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'datasets' && <GenericView queryString={query} props={datasetsDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'specieslists' &&
                            <GenericView queryString={query} props={specieslistDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'dataprojects' &&
                            <GenericView queryString={query} props={dataprojectsDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'environmentallayers' &&
                            <GenericView queryString={query} props={environmentallayersDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'regionslocalities' &&
                            <GenericView queryString={query} props={regionslocalitiesDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'alageneralcontent' &&
                            <GenericView queryString={query} props={wordpressDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                        {tab === 'helparticles' && <GenericView queryString={query} props={supportDefn} tab={tab} setQuery={updateQuery} isMobile={isMobile}/>}
                    </div>
                </div>
            </div>
        </>
    );
}

export default Search;
