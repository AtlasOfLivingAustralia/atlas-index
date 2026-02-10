/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/esm/Modal";
import {useEffect, useState} from "react";
import {DataQualityInfo, QualityFilter} from "../api/model.tsx";
import { FormattedMessage } from 'react-intl';

interface DataQualityFiltersProps {
    onClose: () => void,
    dataQualityInfo: DataQualityInfo,
    dataQuality: any[],
    queryString: string | undefined,
    addParams: (fqs: string[], removeFqs: string[]) => void,
    updateDataQualityInfo: (dataQualityInfo: DataQualityInfo) => void
}

function DataQualityFiltersModal({
                                     onClose,
                                     dataQualityInfo,
                                     dataQuality,
                                     queryString,
                                     addParams,
                                     updateDataQualityInfo
                                 }: DataQualityFiltersProps) {

    const [localCategories, setLocalCategories] = useState<any[]>([]);
    const [toggleChecked, setToggleChecked] = useState(false);

    useEffect(() => {
        let selectedCategories: string[] | undefined = dataQualityInfo.selectedFilters;
        let categories: any[] = [];

        function isExpanded(qualityFilters : QualityFilter[]) {
            let qs = (queryString?.startsWith('?') ? queryString.substring(1) : queryString) || '';
            let terms = qs.split("&");
            for (let filter of qualityFilters) {
                let found = false;
                for (let t of terms) {
                    if (t === "fq=" + filter.filter) {
                        found = true;
                    }
                }
                if (!found) {
                    return false;
                }
            }
            return true;
        }

        for (let dq of dataQuality) {
            if (dq.shortName === dataQualityInfo.profile) {
                for (let cat of dq.categories) {
                    let hasDisableParam =  (queryString?.includes("disableQualityFilter=" + cat.label + "&") ||
                        queryString?.endsWith("disableQualityFilter=" + cat.label))
                    let selected = (selectedCategories === undefined || selectedCategories.includes(cat.label)) && !hasDisableParam;
                    let expanded = hasDisableParam && isExpanded(cat.qualityFilters);
                    categories.push({
                        name: cat.name,
                        label: cat.label,
                        qualityFilters: cat.qualityFilters,
                        selected: selected,
                        expandedOriginal: expanded,
                        expanded: expanded
                    });
                }
            }
        }
        let selectedCount = categories.filter(c => c.selected).length;
        setToggleChecked(selectedCount === categories.length && selectedCount > 0)
        setLocalCategories(categories);
    }, [dataQualityInfo]);

    function addParam(params: string[], param: string) {
        if (!params.includes(param) && !queryString?.includes(encodeURI(param))) {
            params.push(param);
        }
    }

    function update() {
        let fqs: string[] = [];
        let removeFqs: string[] = [];

        dataQualityInfo.selectedFilters = [];
        for (let c of localCategories) {
            if (c.selected) {
                dataQualityInfo.selectedFilters.push(c.label);
                removeFqs.push("disableQualityFilter=" + c.label)
            } else {
                dataQualityInfo.selectedFilters = dataQualityInfo.selectedFilters.filter((value: any) => value !== c.label);
                addParam(fqs, "disableQualityFilter=" + c.label)
            }
        }
        updateDataQualityInfo({...dataQualityInfo})

        for (let c of localCategories) {
            if (c.expanded && !c.expandedOriginal) {
                for (let f of c.qualityFilters) {
                    addParam(fqs, "fq=" + f.filter)
                }
            }
            if (!c.expanded && c.expandedOriginal) {
                // remove expanded state
                removeFqs.push("disableQualityFilter=" + c.label)
                for (let f of c.qualityFilters) {
                    removeFqs.push("fq=" + f.filter)
                }
            }
        }
        if (fqs.length > 0 || removeFqs.length > 0) {
            addParam(fqs, "qualityProfile=" + dataQualityInfo.profile);

            addParams(fqs, removeFqs);
        }

        onClose();
    }

    function toggleAll(value: boolean) {
        for (let cat of localCategories) {
            cat.selected = value;
            if (cat.selected) {
                cat.expanded = false;
            }
        }
        setLocalCategories([...localCategories])
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title><FormattedMessage id="dq.selectmultiple.header.description" defaultMessage="Filter selection"/></Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <table className="table table-bordered">
                    <thead>
                    <tr>
                        <th><FormattedMessage id="dq.selectmultiple.categorytable.header.categories" defaultMessage="Categories"/></th>
                        <th>
                            <input type="checkbox" checked={toggleChecked}
                                   onChange={(e) => setToggleChecked(e.target.checked)}
                                   onClick={(e) => toggleAll((e.target as HTMLInputElement).checked)}/>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {localCategories.map((cat, idx) =>
                        <tr key={idx}>
                            <td>{cat.name}</td>
                            <td>
                                <div className="d-flex no-wrap">
                                    <input type="checkbox" checked={cat.selected} onChange={(e) => {
                                        cat.selected = e.target.checked;
                                        if (cat.selected) {
                                            cat.expanded = false;
                                        }
                                        setLocalCategories([...localCategories]);
                                    }}/>
                                    {cat.selected && <div
                                        onClick={() => {
                                            cat.selected = false;
                                            cat.expanded = true;
                                            setLocalCategories([...localCategories]);
                                        }}
                                        className="ms-2 dqLabel"><FormattedMessage id="dq.selectmultiple.buttontext.expandfilters" defaultMessage="Expand and edit filters"/></div>}
                                    {cat.expanded && <div className="ms-2"><i><FormattedMessage id="dq.selectmultiple.text.expanded" defaultMessage="Expanded"/></i></div>}
                                </div>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn btn-default btn-sm border-black" onClick={() => onClose()}>
                    <FormattedMessage id="dq.selectmultiple.form.cancel" defaultMessage="Cancel"/>
                </button>
                <button id="updateFacetOptions" className="btn btn-primary btn-sm" onClick={() => update()}>
                    <FormattedMessage id="dq.selectmultiple.form.submit" defaultMessage="Apply"/>
                </button>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualityFiltersModal;
