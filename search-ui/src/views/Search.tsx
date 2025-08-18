/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, FontAwesomeIconLite, useHashState, useHeight,} from '@ala/common-ui';
import {faSearch} from '@fortawesome/free-solid-svg-icons';
import {faTimes} from '@fortawesome/free-solid-svg-icons/faTimes';
import {useQueryState} from 'nuqs';
import {useEffect, useRef, useState} from 'react';
import AllView, {searchGroupsTemplate} from '../components/search/allView.tsx';
import GenericView from '../components/search/genericView.tsx';
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
    const contentRef = useRef(null);
    const height = useHeight(contentRef); // Get the measured height

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Search', href: '/'},
        ]);

        setSearchInputText(query || '');
    }, []);

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
                        placeholder="Search species, datasets, content and more..."
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
                    <div style={{marginLeft: '-14px', marginTop: '12px', zIndex: '100', cursor: 'pointer'}}>
                        <button type="button" className="btn btn-link p-0"
                                style={{marginLeft: '-30px', color: 'black'}}
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearchInputText('');
                                    setQuery('');
                                }}>
                            <FontAwesomeIconLite icon={faTimes}/>
                        </button>
                    </div>
                    <button className={classes.searchButton} onClick={() => setQuery(searchInputText)}>
                        <FontAwesomeIconLite icon={faSearch}/>
                    </button>
                </div>
                {isMobile &&
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
            </div>
            {!isMobile &&
                <div className="d-flex justify-content-center flex-wrap"
                     style={{
                         backgroundColor: '#FFFFFF',
                         marginLeft: '-15px',
                         marginRight: '-15px',
                         borderBottom: '1px solid #D9D9D9',
                     }}>
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
            }
            <div className="container"
                 style={{
                     maxWidth: '1280px',
                     height: `${height}px`,
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
    </>;
}

export default Search;
