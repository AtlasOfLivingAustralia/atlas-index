/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {getPortalName, useHashState} from '@ala/common-ui';
import {
    Button,
    Check,
    Link,
    Pagination,
    ResultTile,
    SearchButton,
    SearchField,
    SortDropdown,
    SubNavLink,
    ViewButton,
} from '@ala/ui';
import {useQueryState} from 'nuqs';
import {FormEvent, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Col, Container, Nav, Offcanvas, Placeholder, Row} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {searchGroupsTemplate} from '../components/search/allView.tsx';
import {Examples} from '../components/search/examples.tsx';
import missingImage from '../image/missing-image.png';
import {toResultTile} from './toResultTile.tsx';
import {Facet, fetchSuggestions, MAX_PAGE, PAGE_SIZE, useGroupSummaries, useTabSearch} from './useSearch.ts';

type View = 'list' | 'tiles';

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

function Results({items, groupKey, view, wide = false}: { items: any[], groupKey: string, view: View, wide?: boolean }) {
    const isMobile = useIsMobile();
    const defn = searchGroupsTemplate[groupKey].defn;
    const container = useRef<HTMLDivElement>(null);

    // ResultTile has no image fallback; image errors don't bubble, so catch them in the capture phase.
    useEffect(() => {
        const element = container.current;
        const onError = (event: Event) => {
            const image = event.target;
            if (image instanceof HTMLImageElement && !image.src.endsWith(missingImage)) image.src = missingImage;
        };
        element?.addEventListener('error', onError, true);
        return () => element?.removeEventListener('error', onError, true);
    }, []);

    if (view === 'tiles') {
        return <div ref={container}><Row xs={1} sm={2} lg={wide ? 4 : 3} className="g-4 phx-tiles">
            {items.map((item, index) =>
                <Col key={item.id ?? index}>
                    <ResultTile {...toResultTile(item, defn)} layout={isMobile ? 'mobile' : 'desktop'} size="lg"/>
                </Col>)}
        </Row></div>;
    }
    return <div ref={container} className="phx-list">
        {items.map((item, index) =>
            <ResultTile key={item.id ?? index} {...toResultTile(item, defn)} layout={isMobile ? 'mobile' : 'desktop'} size={isMobile ? 'sm' : 'md'}/>)}
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

    return <Row>
        <Col lg={3} as="aside" className="d-none d-lg-block" aria-label="Refine results">{total > 0 && refine}</Col>
        <Col lg={9} aria-busy={loading}>
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
                <SortDropdown options={sortOptions} value={sort} onChange={value => {
                    localStorage.setItem('searchSort', value);
                    setSort(value);
                    setPage(0);
                }}/>
            </div>}
            {loading && results.length === 0
                ? <Placeholder as="div" animation="glow"><Placeholder xs={12} className="phx-placeholder"/></Placeholder>
                : <Results items={results} groupKey={groupKey} view={view}/>}
            {pageCount > 1 && <div className="phx-pagination">
                <Pagination page={page + 1} pageCount={pageCount} onPageChange={number => {
                    setPage(number - 1);
                    window.scrollTo({top: 0, behavior: 'smooth'});
                }}/>
            </div>}
            {defn.resourceLinks && <div className="phx-resource-links">
                {/* phoenix Button omits href, so external resource links use the arrow Link. */}
                {defn.resourceLinks.map(link =>
                    <Link key={link.label} href={link.url} target="_blank" rel="noopener">{link.label}</Link>)}
            </div>}
        </Col>
        <Offcanvas show={showRefine} onHide={() => setShowRefine(false)} placement="start" aria-label="Refine results">
            <Offcanvas.Header closeButton/>
            <Offcanvas.Body>{refine}</Offcanvas.Body>
        </Offcanvas>
    </Row>;
}

function AllResults({query, setTab}: { query: string, setTab: (tab: string) => void }) {
    const [view, setView] = useStoredView();
    const {loading, groups} = useGroupSummaries(query);
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    return <div aria-busy={loading}>
        <p className="phx-results-title" role="status">
            {loading ? 'Searching…' : total > 0 ? <>Showing results for <i>{query}</i></> : <>No results found for <i>{query}</i></>}
        </p>
        {total > 0 && <div className="phx-toolbar"><ViewToggle view={view} setView={setView}/></div>}
        {groups.map(group => <section key={group.key} className="phx-group" aria-labelledby={`group-${group.key}`}>
            <div className="phx-group-header">
                <h2 id={`group-${group.key}`}>{group.label}</h2>
                <Link variant="count" href={`#tab=${group.key}`} onClick={event => {
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
        setQuery(value || null);
        if (nextTab !== tab) setTab(nextTab);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        search(text);
    };
    const tabs = [['all', 'All'] as const, ...Object.entries(searchGroupsTemplate).map(([key, group]) => [key, group.label] as const)];
    const activeTab = tab in searchGroupsTemplate ? tab : 'all';

    return <>
        <section className="phx-hero">
            <Container>
                <h1>
                    <FormattedMessage id="home.title" defaultMessage="Search {portalName}"
                                      values={{portalName: getPortalName('Atlas of Living Australia')}}/>
                </h1>
                <form role="search" className="phx-search" onSubmit={submit}>
                    {/* phoenix has no autocomplete; a native datalist keeps suggestions without custom ARIA. */}
                    <SearchField
                        id="phoenix-search"
                        label={intl.formatMessage({id: 'home.searchPlaceholder', defaultMessage: 'Search species, datasets, content and more...'})}
                        placeholder={intl.formatMessage({id: 'home.searchPlaceholder', defaultMessage: 'Search species, datasets, content and more...'})}
                        value={text}
                        list="phoenix-search-suggestions"
                        autoComplete="off"
                        onChange={event => setText(event.currentTarget.value)}
                        onClear={text ? () => search('') : undefined}
                    />
                    <datalist id="phoenix-search-suggestions">
                        {suggestions.map(name => <option key={name} value={name}/>)}
                    </datalist>
                    <SearchButton/>
                </form>
                <div className="phx-examples">
                    Try searching for:&nbsp;
                    <Examples asText={true} tab={tab} setQueryAndTab={(value: string, nextTab?: string) => search(value, nextTab || 'all')}/>
                </div>
            </Container>
        </section>
        {query && <>
            <nav className="phx-tabs" aria-label="Result types">
                <Container>
                    <Nav activeKey={activeTab} onSelect={key => key && setTab(key)}>
                        {tabs.map(([key, label]) =>
                            <Nav.Item key={key}>
                                <SubNavLink as="button" eventKey={key} aria-current={key === activeTab ? 'true' : undefined}>{label}</SubNavLink>
                            </Nav.Item>)}
                    </Nav>
                </Container>
            </nav>
            <Container className="phx-results">
                {activeTab === 'all'
                    ? <AllResults query={query} setTab={setTab}/>
                    : <TabResults key={`${activeTab}|${query}`} query={query} groupKey={activeTab}/>}
            </Container>
        </>}
    </>;
}
