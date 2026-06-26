/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage, useIntl } from 'react-intl';
import {getQc} from "../../util/util.tsx";

interface LsidDropdownProps {
    lsid: string;
    nameString: string;
    index: number;
}

interface FacetResult {
    label: string;
    count: number;
}

interface FacetEntry {
    fieldName: string;
    fieldResult: FacetResult[];
}

interface BiocacheResponse {
    facetResults: FacetEntry[];
}

const MAX_FACETS = 20;

function LsidDropdown({ lsid, nameString, index }: LsidDropdownProps) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<BiocacheResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const btnGroupRef = useRef<HTMLSpanElement>(null);
    const toggleBtnRef = useRef<HTMLButtonElement>(null);

    const biocacheUrl = import.meta.env.VITE_APP_BIOCACHE_URL;
    const bieSpeciesUrl = import.meta.env.VITE_SPECIES_URL_PREFIX;
    const contextPath = import.meta.env.VITE_APP_BASE_URL;
    const speciesPageUri = `${bieSpeciesUrl}${lsid}`;

    const intl = useIntl();

    function fetchData() {
        if (data || loading) return;
        setLoading(true);
        const jsonUri = `${biocacheUrl}/occurrences/search?q=lsid:${lsid}&facets=raw_scientificName&pageSize=0&flimit=${MAX_FACETS}${getQc()}`;
        fetch(jsonUri)
            .then(r => r.json())
            .then((d: BiocacheResponse) => setData(d))
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }

    function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (!open) {
            fetchData();
            const rect = toggleBtnRef.current?.getBoundingClientRect();
            if (rect) {
                setMenuPos({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                });
            }
        }
        setOpen(prev => !prev);
    }

    function handleCheck(label: string, value: boolean) {
        setChecked(prev => ({ ...prev, [label]: value }));
    }

    function handleRefine(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        const selected = Object.entries(checked)
            .filter(([, v]) => v)
            .map(([label]) => `raw_scientificName:%22${encodeURIComponent(label)}%22`);
        if (selected.length === 0) return;
        const q = selected.join(' OR ');
        window.location.href = `${contextPath}/occurrences/search?q=${q}`;
    }

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClickOutside(e: MouseEvent) {
            if (btnGroupRef.current && !btnGroupRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        setTimeout(() => document.addEventListener("click", handleClickOutside), 10);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [open]);

    // Get facet results
    const facetResults: FacetResult[] = data?.facetResults
        ?.find(f => f.fieldName === "raw_scientificName")
        ?.fieldResult ?? [];

    const anyChecked = Object.values(checked).some(Boolean);

    const dropdownMenu = open ? createPortal(
        <div
            className="dropdown-menu show"
            id={`dropdown_resultsReturnedTemplate_${index}`}
            style={{ position: "absolute", top: menuPos.top, left: menuPos.left, zIndex: 1050, minWidth: "300px" }}
            onClick={e => e.stopPropagation()}
        >
            <div className="taxaMenuContent" style={{ padding: "8px 16px" }}>
                <FormattedMessage id={'list.resultsreturned.div01.des01'} defaultMessage={'list.resultsreturned.div01.des01'}/>&nbsp;
                <b className="nameString">{nameString}</b>&nbsp;
                (<span className="speciesPageLink">
                    <a href={speciesPageUri} title="View species page" target="BIE"><FormattedMessage id={'search.species.view.desc"'} defaultMessage={'view species page'}/></a>
                </span>).
                <div className="refineTaxaSearch" id={`refineTaxaSearch_${index}`}>
                    <div style={{ marginBottom: '6px' }}>
                        <FormattedMessage id={'list.resultsreturned.form.des01'} defaultMessage={'The result set contains records provided under the following names'}/>:
                    </div>
                    <button
                        id={`rawTaxonSumbit_${index}`}
                        className="btn btn-sm btn-outline-dark rawTaxonSumbit mb-2"
                        title={intl.formatMessage({id: 'list.resultsreturned.restrict.results', defaultMessage: 'Restrict results to the selected names'})}
                        disabled={!anyChecked}
                        onClick={handleRefine}
                        type="button"
                    >
                        <FormattedMessage id={'list.resultsreturned.form.button01'} defaultMessage={'Refine search'}/>
                    </button>
                    <div className="rawTaxaList">
                        {loading
                            ? <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                            : facetResults.length === 0
                                ? <span>[no records found]</span>
                                : <>
                                    {facetResults.map((item, j) => (
                                        <div key={j}>
                                            <input
                                                type="checkbox"
                                                id={`rawTaxon_${index}_${j}`}
                                                className="rawTaxonCheckBox"
                                                checked={!!checked[item.label]}
                                                onChange={e => handleCheck(item.label, e.target.checked)}
                                            />&nbsp;
                                            <a href={`${contextPath}/occurrences/search?q=raw_scientificName:%22${encodeURIComponent(item.label)}%22`}>
                                                {item.label}
                                            </a> ({item.count})
                                        </div>
                                    ))}
                                    {facetResults.length >= MAX_FACETS && (
                                        <div><br />Only showing the first {MAX_FACETS} names<br />
                                            See the "Scientific name (unprocessed)" section in the "Refine results" column on the left for a complete list
                                        </div>
                                    )}
                                </>
                        }
                    </div>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <span className="btn-group" ref={btnGroupRef} id={`resultsReturnedTemplate_${index}`} style={{ position: "relative" }}>
            <a className="btn btn-outline-dark btn-sm" href={speciesPageUri} id={`taxa_${index}`} title="Taxon info" target="BIE" style={{textDecoration: 'none'}} >
                {nameString}
            </a>
            <button
                ref={toggleBtnRef}
                className="btn btn-outline-dark btn-sm"
                title="Click for more info"
                onClick={handleToggle}
                type="button"
            >
                <i className={`bi bi-caret-${open ? 'up' : 'down'}-fill`}></i>
            </button>
            {dropdownMenu}
        </span>
    );
}

export default LsidDropdown;

