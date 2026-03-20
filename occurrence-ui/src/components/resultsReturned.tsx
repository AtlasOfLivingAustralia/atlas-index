/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useRef, useState } from 'react';
import TaxonDropdown from "./taxonDropdown.tsx";

interface ResultsReturnedProps {
    results?: {
        totalRecords?: number;
        queryTitle?: string;
    };
    queryString?: string;
}

function ResultsReturned({results, queryString}: ResultsReturnedProps) {

    const [expanded, setExpanded] = useState(false);
    const [showToggle, setShowToggle] = useState(false);
    const [count, setCount] = useState<number | undefined>();

    const queryRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        // Temporarily force truncated class to measure natural overflow, then restore
        if (queryRef.current) {
            const el = queryRef.current;
            const prev = el.className;
            el.className = 'query-text-truncated';
            setShowToggle(el.scrollHeight > el.clientHeight);
            el.className = prev;
        }
    }, [results]);

    useEffect(() => {
        setCount(undefined);
        updateCount();
    }, [queryString, results]);

    function updateCount() {
        if (queryString) {
            let thisQueryString = queryString + "&disableAllQualityFilters=true";

            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search" + thisQueryString, {})
                  .then(response => response.json())
                  .then(data => setCount(data.totalRecords))
                  .catch(e => console.error(e));
        }
    }

    function toggleExpanded(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        if (expanded) {
            setExpanded(false);
            setTimeout(() => {
                if (queryRef.current) {
                    const rect = queryRef.current.getBoundingClientRect();
                    const inView = rect.top >= 0 && rect.top < window.innerHeight;
                    if (!inView) {
                        queryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                }
            }, 0);
        } else {
            setExpanded(true);
        }
    }

    return <>
        <div id="returnedText" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 4px' }}>
            {!results?.totalRecords
                ? <div className="spinner-border" role="status" style={{width: "1em", height: "1em"}}><span className="visually-hidden">...</span></div>
                : <strong>{results && new Intl.NumberFormat().format(results.totalRecords)}</strong>
            }
            <span>records returned</span>
            {count === undefined
                ? <><span>of</span><div className="spinner-border spinner-border-sm" role="status" style={{width: "1em", height: "1em"}}><span className="visually-hidden">...</span></div></>
                : <><span>of</span><strong>{new Intl.NumberFormat().format(count)}</strong></>
            }
            <span>for</span>
            <span className="queryDisplay" id="queryDisplayContainer" style={{ flex: '1 1 auto', minWidth: 0 }}>
                <strong>
                    <span id="queryDisplayText" className={`query-text-${expanded ? "expanded" : "truncated"}`} ref={queryRef}>
                        <TaxonDropdown htmlContent={results && results.queryTitle}/>
                    </span>
                </strong>
                {showToggle &&
                    <a href="#" id="queryDisplayToggle" className="query-toggle" style={{marginLeft: '-5px', textDecoration: 'none'}}
                        onClick={e => toggleExpanded(e)}>
                        {expanded ? <i className="bi bi-caret-up-fill"></i> : <i className="bi bi-caret-right-fill"></i>}
                        <span className="toggle-text">{expanded ? "Show less" : "Show more"}</span>
                    </a>
                }
            </span>
        </div>
    </>
}

export default ResultsReturned;
