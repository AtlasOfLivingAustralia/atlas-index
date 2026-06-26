/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, FontAwesomeIconLite, useHashState} from '@ala/common-ui';
import {faSearch, faTimes} from '@fortawesome/free-solid-svg-icons';
import {useQueryState} from 'nuqs';
import {useEffect, useRef, useState} from 'react';
import AllView, {searchGroupsTemplate} from '../components/search/allView.tsx';
import {Examples} from "../components/search/examples.tsx";
import GenericView from '../components/search/genericView.tsx';
import LandingPage from "../components/search/landingPage.tsx";
import classes from '../components/search/search.module.css';

function Search({setBreadcrumbs, isMobile}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void,
    isMobile: boolean
}) {
    const [searchInputText, setSearchInputText] = useState<string>('');
    const [query, setQuery] = useQueryState('q');
    const [tab, setTab] = useHashState('tab', 'all');
    const [landingPage, setLandingPage] = useState(!query);
    const contentRef = useRef(null);
    const [autoCompleteResults, setAutoCompleteResults] = useState<Array<{name: string}>>([]);
    const [showAutoComplete, setShowAutoComplete] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debounceTimerRef = useRef<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Search', href: '/'},
        ]);

        setSearchInputText(query || '');
    }, []);

    const fetchAutoComplete = async (searchText: string) => {
        if (searchText.trim().length < 3) {
            setAutoCompleteResults([]);
            setShowAutoComplete(false);
            return;
        }

        try {
            const response = await fetch(
                `${import.meta.env.VITE_APP_API_URL}/v1/bie/search/auto?limit=20&q=${encodeURIComponent(searchText)}`
            );
            const data = await response.json();

            // build list of unique names from autoCompleteList, ignoring case
            const seen = new Set<string>();
            const uniqueResults = [];
            for (const item of data.autoCompleteList || []) {
                if (item.matchedNames && item.matchedNames[0]) {
                    const lowerName = item.matchedNames[0].toLowerCase();
                    if (!seen.has(lowerName)) {
                        seen.add(lowerName);
                        uniqueResults.push({ name: item.matchedNames[0] });
                    }
                }
            }

            setAutoCompleteResults(uniqueResults || []);
            setShowAutoComplete(true);
            setActiveIndex(-1);
        } catch (error) {
            console.error('Autocomplete fetch error:', error);
            setAutoCompleteResults([]);
            setShowAutoComplete(false);
        }
    };

    const handleInputChange = (value: string) => {
        setSearchInputText(value);

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new timer for debounced fetch
        debounceTimerRef.current = window.setTimeout(() => {
            fetchAutoComplete(value);
        }, 300);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(prev =>
                prev < autoCompleteResults.length - 1 ? prev + 1 : prev
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            if (activeIndex >= 0 && autoCompleteResults[activeIndex]) {
                selectAutoComplete(autoCompleteResults[activeIndex].name);
            } else {
                setSearchInputText(event.currentTarget.value);
                setQuery(event.currentTarget.value);
                setLandingPage(false);
                setShowAutoComplete(false);
            }
        } else if (event.key === 'Escape') {
            setShowAutoComplete(false);
            setActiveIndex(-1);
        }
    };

    const selectAutoComplete = (name: string) => {
        setSearchInputText(name);
        setQuery(name);
        setLandingPage(false);
        setShowAutoComplete(false);
        setActiveIndex(-1);
    };

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || '';
        setTab(tabsTab);
    };

    const updateQuery = (query: string) => {
        setSearchInputText(query);
        setQuery(query);
    };

    return <>
        <div className="container-fluid" style={{marginTop: '-47px'}}>
            <div className={classes.headerLogo}
                 style={{backgroundColor: '#E7E7E7', marginLeft: '-15px', marginRight: '-15px'}}>
                <div className="d-flex justify-content-center">
                    <span className={classes.searchTitle}>
                        Search Atlas of Living Australia
                    </span>
                </div>
                <div className={'d-flex justify-content-center ' + classes.searchContainer}>
                    <input
                        ref={inputRef}
                        placeholder="Search species, datasets, content and more..."
                        className={classes.searchInput}
                        value={searchInputText}
                        onChange={(event) => handleInputChange(event.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            // Delay hiding to allow click events to register
                            setTimeout(() => setShowAutoComplete(false), 200);
                        }}
                    />
                    {showAutoComplete && autoCompleteResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: inputRef && inputRef.current ? inputRef.current.getBoundingClientRect().left : 0,
                            backgroundColor: 'white',
                            border: '1px solid black',
                            maxHeight: '600px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '2px',
                            minWidth: '200px',
                            width: 'auto',
                            whiteSpace: 'nowrap'
                        }}>
                            {autoCompleteResults.map((item, index) => (
                                <div
                                    key={index}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectAutoComplete(item.name);
                                    }}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        backgroundColor: activeIndex === index ? '#f0f0f0' : 'white',
                                        transition: 'background-color 0.1s'
                                    }}
                                >
                                    {item.name}
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{marginLeft: '-14px', marginTop: '12px', zIndex: '100', cursor: 'pointer'}}>
                        <button type="button" className="btn btn-link p-0"
                                style={{marginLeft: '-30px', color: 'black'}}
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearchInputText('');
                                    setQuery('');
                                    setShowAutoComplete(false);
                                }}>
                            <FontAwesomeIconLite icon={faTimes}/>
                        </button>
                    </div>
                    <button className={classes.searchButton} onClick={() => {
                        if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = null;
                        }
                        setQuery(searchInputText);
                        setLandingPage(false);
                        setShowAutoComplete(false);
                    }}>                        <FontAwesomeIconLite icon={faSearch}/>
                    </button>
                </div>
                {!isMobile &&
                    <div className={"d-flex justify-content-center " + classes.searchContainerInfo} >
                        Try searching for:&nbsp;
                        <Examples asText={true} tab={tab} setQueryAndTab={(query: string, tab: string | undefined) => {setLandingPage(false); setQuery(query); setTab(tab || 'all'); setSearchInputText(query); setLandingPage(false);}}/>
                    </div>
                }
                {isMobile && !landingPage &&
                    <div className={'d-flex justify-content-center '}>
                        <select className={'form-select ' + classes.mobileSelect} value={tab}
                                onChange={(event) => handleTabChange(event.target.value)}>
                            <option value="all">All</option>

                            {/*Alphabetical order by label after "All"*/}
                            {Object.entries(searchGroupsTemplate).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, group]) =>
                                <option key={key} value={key}>
                                    {group.label}
                                </option>
                            )}
                        </select>
                    </div>
                }
                {isMobile && <div style={{ height: '20px'}}>&nbsp;</div>}
            </div>
            {isMobile && landingPage && <div style={{ marginTop: '20px'}}>
                <div style={{fontFamily: 'Roboto', fontWeight: '600', fontSize: '26px', lineHeight: '32px', color: '#C44D34', textAlign: 'left', marginBottom: '20px'}}>
                Try searching for</div>
                <Examples asText={false} tab={tab} setQueryAndTab={(query: string, tab: string | undefined) => {setLandingPage(false); setQuery(query); setTab(tab || 'all'); setSearchInputText(query); setLandingPage(false);}}/>
            </div>}
            {!isMobile && !landingPage &&
                <div style={{borderBottom: '1px solid #D9D9D9', marginLeft: '-15px', marginRight: '-15px'}}>
                    <div className="d-flex flex-wrap" style={{maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto'}}>
                        <div className={`${tab === 'all' ? classes.activeTab : ''} ${classes.tabButtons}`}
                             onClick={() => handleTabChange('all')}>
                            {/*<AllIcon/>*/}
                            All
                        </div>

                        {/*default order after "All"*/}
                        {Object.entries(searchGroupsTemplate)
                            .map(([key, group]) =>
                                <div key={key}
                                     className={`${tab === key ? classes.activeTab : ''} ${classes.tabButtons}`}
                                     onClick={() => handleTabChange(key)}>
                                    {group.label}
                                </div>
                            )}
                    </div>
                </div>
            }
            {!landingPage &&
                <div className="row">
                    <div className="container"
                         style={{
                             maxWidth: '1200px',
                             overflow: 'hidden',
                             transition: 'height 0.5s ease-in-out',
                             minHeight: '500px',
                         }}>
                        <div ref={contentRef}>
                            <div style={{height: '30px'}}/>
                            {tab === 'all' ?
                                <AllView queryString={query}
                                         setQuery={updateQuery}
                                         setTab={setTab}
                                         isMobile={isMobile}
                                />
                                :
                                <GenericView key={tab}
                                             queryString={query}
                                             props={searchGroupsTemplate[tab].defn}
                                             tab={tab}
                                             setQuery={updateQuery}
                                             isMobile={isMobile}
                                />
                            }
                        </div>
                    </div>
                </div>
            }
            {landingPage && <LandingPage isMobile={isMobile} /> }
        </div>
    </>;
}

export default Search;
