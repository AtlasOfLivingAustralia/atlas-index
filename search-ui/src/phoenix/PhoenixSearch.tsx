/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {getPortalName, useHashState} from '@ala/common-ui';
import {
    Button,
    Check,
    Icon,
    type IconName,
    Link,
    Pagination,
    ResultTile,
    SearchButton,
    SearchField,
    SortDropdown,
    Tabs,
    ViewButton,
} from '@ala/ui';
import {useQueryState} from 'nuqs';
import {FormEvent, useEffect, useState, useSyncExternalStore} from 'react';
import {Container, Nav, Offcanvas, Placeholder} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {searchGroupsTemplate} from '../components/search/allView.tsx';
import {Examples} from '../components/search/examples.tsx';
import {toResultTile} from './toResultTile.tsx';
import {Facet, fetchSuggestions, MAX_PAGE, PAGE_SIZE, useGroupSummaries, useTabSearch} from './useSearch.ts';

type View = 'list' | 'tiles';

// Figma "Search type tabs" show a 12px search-type icon before each label.
const tabIcons: Record<string, IconName> = {
    all: 'search-type-all',
    species: 'search-type-species',
    datasets: 'search-type-datasets',
    specieslists: 'search-type-species-lists',
    projects: 'search-type-data-projects',
    layers: 'search-type-environmental-layers',
    locations: 'search-type-regions',
    articles: 'search-type-help-articles',
};

const mobileQuery = window.matchMedia('(max-width: 767.98px)');
// ResultTile picks desktop/mobile layouts by prop, not CSS, so the breakpoint is needed in JS.
const useIsMobile = () => useSyncExternalStore(
    callback => {
        mobileQuery.addEventListener('change', callback);
        return () => mobileQuery.removeEventListener('change', callback);
    },
    () => mobileQuery.matches,
);

function useStoredView(): [View, (view: View) => void] {
    const [view, setView] = useState<View>(() => localStorage.getItem('searchView') === 'tiles' ? 'tiles' : 'list');
    return [view, (next: View) => {
        localStorage.setItem('searchView', next);
        setView(next);
    }];
}

function ViewToggle({view, setView}: { view: View, setView: (view: View) => void }) {
    return <div className="phx-view-toggle" role="group" aria-label="View as">
        <span aria-hidden="true">View as</span>
        <ViewButton view="list" active={view === 'list'} onClick={() => setView('list')}/>
        <ViewButton view="tiles" active={view === 'tiles'} onClick={() => setView('tiles')}/>
    </div>;
}

/** List rows are 845px in a tab and 1140px in "All"; tiles are 3 or 4 columns of 255px. */
function Results({items, groupKey, view, wide = false}: { items: any[], groupKey: string, view: View, wide?: boolean }) {
    const isMobile = useIsMobile();
    const defn = searchGroupsTemplate[groupKey].defn;
    const layout = isMobile ? 'mobile' : 'desktop';
    if (view === 'tiles') {
        return <div className={`phx-tiles ${wide ? 'phx-tiles--wide' : ''}`}>
            {items.map((item, index) =>
                <ResultTile key={item.id ?? index} {...toResultTile(item, defn)} layout={layout} size="lg"/>)}
        </div>;
    }
    return <div className="phx-list">
        {items.map((item, index) =>
            <ResultTile key={item.id ?? index} {...toResultTile(item, defn)} layout={layout} size={isMobile || !wide ? 'sm' : 'md'}/>)}
    </div>;
}

function FacetGroup({facet, onToggle}: { facet: Facet, onToggle: (fq: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const limit = facet.lessNumber && !expanded ? facet.lessNumber : facet.items.length;
    return <fieldset className="phx-facet">
        <legend>{facet.name}</legend>
        {facet.items.length === 0 && <em>Not supplied</em>}
        {facet.items.slice(0, limit).map(item =>
            <Check
                key={item.fq}
                id={`facet-${facet.name}-${item.fq}`.replace(/[^\w-]/g, '_')}
                label={`${item.label} (${item.count.toLocaleString()})`}
                size="lg"
                checked={!!item.selected}
                disabled={!item.selected && item.count === 0}
                onChange={() => onToggle(item.fq)}
                style={{marginLeft: `${item.depth * 22}px`}}
            />)}
        {facet.lessNumber !== undefined && facet.items.length > facet.lessNumber &&
            <Button variant="link" arrow={false} icon={expanded ? 'chevron-up' : 'chevron-down'} iconPosition="start"
                    aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : 'Show more'}
            </Button>}
    </fieldset>;
}

function TabResults({query, groupKey}: { query: string, groupKey: string }) {
    const defn = searchGroupsTemplate[groupKey].defn;
    const sortOptions = [
        {label: 'Most relevant', value: ''},
        ...(defn.sortByDate ? [{label: 'Newest', value: '&sort=created&dir=desc'}] : []),
        {label: 'Sort by A-Z', value: '&sort=nameSort&dir=asc'},
        {label: 'Sort by Z-A', value: '&sort=nameSort&dir=desc'},
    ];
    const [view, setView] = useStoredView();
    const [page, setPage] = useState(0);
    const [sort, setSort] = useState(() => {
        const stored = localStorage.getItem('searchSort') ?? '';
        return sortOptions.some(option => option.value === stored) ? stored : '';
    });
    const [fqs, setFqs] = useState<string[]>([]);
    const [showRefine, setShowRefine] = useState(false);
    const {loading, total, results, facets} = useTabSearch(query, defn, page, sort, fqs);
    const pageCount = Math.min(MAX_PAGE, Math.ceil(total / PAGE_SIZE));

    const toggle = (fq: string) => {
        setFqs(current => current.includes(fq) ? current.filter(value => value !== fq) : [...current, fq]);
        setPage(0);
    };
    const refine = <>
        <h2 className="phx-refine-title">Refine results</h2>
        {facets.length === 0 && loading && <Placeholder as="div" animation="glow"><Placeholder xs={12} className="phx-placeholder"/></Placeholder>}
        {facets.map(facet => <FacetGroup key={facet.name} facet={facet} onToggle={toggle}/>)}
    </>;

    return <div className="phx-layout">
        <aside className="d-none d-lg-block" aria-label="Refine results">{total > 0 && refine}</aside>
        <div aria-busy={loading}>
            <p className="phx-results-title" role="status">
                {loading ? 'Searching…' : total > 0
                    ? <>Showing <b>{page * PAGE_SIZE + 1}-{Math.min(total, (page + 1) * PAGE_SIZE)}</b> of <b>{total.toLocaleString()}</b> results for <i>{query}</i></>
                    : <>No results found for <i>{query}</i></>}
            </p>
            {total > 0 && <div className="phx-toolbar">
                <ViewToggle view={view} setView={setView}/>
                <Button variant="secondary" arrow={false} icon="filter" className="d-lg-none" onClick={() => setShowRefine(true)}>
                    Refine results
                </Button>
                <div className="phx-sort">
                    <span className="d-none d-md-inline" aria-hidden="true">Sort by</span>
                    <SortDropdown options={sortOptions} value={sort} onChange={value => {
                        localStorage.setItem('searchSort', value);
                        setSort(value);
                        setPage(0);
                    }}/>
                </div>
            </div>}
            {loading && results.length === 0
                ? <Placeholder as="div" animation="glow"><Placeholder xs={12} className="phx-placeholder"/></Placeholder>
                : <Results items={results} groupKey={groupKey} view={view}/>}
            {pageCount > 1 && <div className="phx-pagination">
                <Pagination page={page + 1} pageCount={pageCount} window={4} onPageChange={number => {
                    setPage(number - 1);
                    window.scrollTo({top: 0, behavior: 'smooth'});
                }}/>
            </div>}
            {defn.resourceLinks && <div className="phx-resource-links">
                {/* phoenix Button omits href, so external resource links use the arrow Link. */}
                {defn.resourceLinks.map(link =>
                    <Link key={link.label} href={link.url} target="_blank" rel="noopener">{link.label}</Link>)}
            </div>}
        </div>
        <Offcanvas show={showRefine} onHide={() => setShowRefine(false)} placement="start" aria-label="Refine results">
            <Offcanvas.Header closeButton/>
            <Offcanvas.Body>{refine}</Offcanvas.Body>
        </Offcanvas>
    </div>;
}

function AllResults({query, setTab}: { query: string, setTab: (tab: string) => void }) {
    const [view, setView] = useStoredView();
    const {loading, groups} = useGroupSummaries(query);
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    return <div aria-busy={loading}>
        {/* Figma "All" has no results heading; keep the count for screen readers. */}
        <p className={total > 0 && !loading ? 'visually-hidden' : 'phx-results-title'} role="status">
            {loading ? 'Searching…' : total > 0 ? <>Showing results for {query}</> : <>No results found for <i>{query}</i></>}
        </p>
        {total > 0 && <div className="phx-toolbar"><ViewToggle view={view} setView={setView}/></div>}
        {groups.map(group => <section key={group.key} className="phx-group" aria-labelledby={`group-${group.key}`}>
            <div className="phx-group-header">
                <h2 id={`group-${group.key}`}>{group.label}</h2>
                <Link variant="count" size="lg" href={`#tab=${group.key}`} onClick={event => {
                    event.preventDefault();
                    window.scrollTo({top: 0, behavior: 'smooth'});
                    setTab(group.key);
                }}>
                    See {group.count.toLocaleString()} results
                </Link>
            </div>
            <Results items={group.items} groupKey={group.key} view={view} wide/>
        </section>)}
    </div>;
}

export default function PhoenixSearch() {
    const intl = useIntl();
    const [query, setQuery] = useQueryState('q');
    const [tab, setTab] = useHashState('tab', 'all');
    const [text, setText] = useState(query ?? '');
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        if (text.trim().length < 3 || text === query) {
            setSuggestions([]);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => fetchSuggestions(text, controller.signal).then(setSuggestions).catch(() => undefined), 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [text, query]);

    const search = (value: string, nextTab = tab) => {
        setText(value);
        setSuggestions([]);
        setQuery(value || null);
        if (nextTab !== tab) setTab(nextTab);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        search(text);
    };
    const tabs = [['all', 'All'] as const, ...Object.entries(searchGroupsTemplate).map(([key, group]) => [key, group.label] as const)];
    const activeTab = tab in searchGroupsTemplate ? tab : 'all';
    const placeholder = intl.formatMessage({id: 'home.searchPlaceholder', defaultMessage: 'Search species, datasets, content and more...'});

    return <>
        <section className={`phx-hero ${query ? 'phx-hero--results' : ''}`}>
            <Container>
                <h1>
                    <FormattedMessage id="home.title" defaultMessage="Search {portalName}"
                                      values={{portalName: getPortalName('Atlas of Living Australia')}}/>
                </h1>
                <form role="search" className="phx-search" onSubmit={submit}>
                    <SearchField
                        id="phoenix-search"
                        label={placeholder}
                        placeholder={placeholder}
                        value={text}
                        autoComplete="off"
                        onChange={event => setText(event.currentTarget.value)}
                        onClear={text ? () => search('') : undefined}
                        // The BIE autocomplete only returns taxon names.
                        suggestions={suggestions.map(label => ({label, icon: 'search-type-species'}))}
                        onSuggestionSelect={suggestion => search(suggestion.label)}
                    />
                    <SearchButton/>
                </form>
                {query
                    ? <nav className="phx-tabs" aria-label="Result types">
                        <Nav activeKey={activeTab} onSelect={key => key && setTab(key)}>
                            {tabs.map(([key, label]) =>
                                <Nav.Item key={key}>
                                    <Tabs as="button" eventKey={key} aria-current={key === activeTab ? 'true' : undefined}>
                                        <Icon name={tabIcons[key] ?? 'search-type-all'} size={12}/>{label}
                                    </Tabs>
                                </Nav.Item>)}
                        </Nav>
                    </nav>
                    : <div className="phx-examples">
                        Try searching for:&nbsp;
                        <Examples asText={true} tab={tab} setQueryAndTab={(value: string, nextTab?: string) => search(value, nextTab || 'all')}/>
                    </div>}
            </Container>
        </section>
        {query && <Container className={`phx-results ${activeTab === 'all' ? 'phx-results--all' : ''}`}>
            {activeTab === 'all'
                ? <AllResults query={query} setTab={setTab}/>
                : <TabResults key={`${activeTab}|${query}`} query={query} groupKey={activeTab}/>}
        </Container>}
    </>;
}
