/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import Modal from "react-bootstrap/esm/Modal";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {DataQualityInfo, IndexFields, QualityCategory} from "../api/model.tsx";

interface DataQualityInfoModalProps {
    onClose: () => void,
    dataQualityInfo: DataQualityInfo,
    category: QualityCategory,
    queryString: string | undefined,
    addParams: (fqs: string[], removeFqs: string[]) => void
}

function DataQualityCategoryInfoModal({
                                          onClose,
                                          dataQualityInfo,
                                          category,
                                          queryString,
                                          addParams
                                      }: DataQualityInfoModalProps) {

    const [count, setCount] = useState<number | undefined>();
    const [expanded, setExpanded] = useState<boolean>(false);
    const [catFilter, setCatFilter] = useState<string>('');
    const [indexedFields, setIndexedFields] = useState<IndexFields>({});
    const [catFields, setCatFields] = useState<string[]>([]);

    const intl: IntlShape = useIntl();

    useEffect(() => {
        let isExpanded = (queryString?.includes("disableQualityFilter=" + category.label + "&") ||
            queryString?.endsWith("disableQualityFilter=" + category.label))
        if (isExpanded) {
            setCount(0);
        } else {
            updateCount();
        }
        setExpanded(isExpanded || false);
        setCatFilter(category.qualityFilters.map(f => f.filter).join(" AND "));

        updateIndexedFields();
    }, [category]);

    function updateIndexedFields() {
        fetch(import.meta.env.VITE_APP_INDEX_FIELDS_URL, {}).then(response => response.json()).then(json => {
            let map : IndexFields = {};
            for (let field of json) {
                map[field.name] = field;
            }
            setIndexedFields(map);

            let fields: string[] = [];
            for (let filter of category.qualityFilters) {
                let name = fieldName(filter.filter)
                if (!fields.includes(name)) {
                    fields.push(name);
                }
            }
            fields.sort();
            setCatFields(fields);
        });
    }

    function updateCount() {
        if (queryString && category) {
            const qc = (import.meta.env.VITE_QUERY_CONTEXT || '') ? `&qc=${import.meta.env.VITE_QUERY_CONTEXT}` : '';
            let thisQueryString = queryString + "&disableAllQualityFilters=true&fq=" + category.inverseFilter;

            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search" + thisQueryString + qc, {}).then(response => response.json())
                .then(data => setCount(data.totalRecords));
        }
    }

    function infoUrl(fq: string) {
        let match = fq.match(/-?assertions:(\w+)/);
        if (match && match.length > 1) {
            return import.meta.env.VITE_APP_DQ_WIKI_URL + match[1];
        }

        match = fq.match(/-?(\w+):/);
        if (match && match.length > 1) {
            return import.meta.env.VITE_APP_DQ_WIKI_URL + match[1];
        }

        return null;
    }

    function showOnly() {
        addParams(["disableAllQualityFilters=true", "fq=" + category.inverseFilter], []);

        onClose();
    }

    function addParam(params: string[], param: string) {
        if (!params.includes(param) && !queryString?.includes(encodeURI(param))) {
            params.push(param);
        }
    }

    function expand() {

        let fqs: string[] = [];

        addParam(fqs, "disableQualityFilter=" + category.label)

        for (let f of category.qualityFilters) {
            addParam(fqs, "fq=" + f.filter)
        }

        addParam(fqs, "qualityProfile=" + dataQualityInfo.profile);

        addParams(fqs, []);

        onClose();
    }

    function fieldName(fq: string) {
        let match = fq.match(/-?(\w+):/);
        if (match && match.length > 1) {
            return match[1];
        }
        return "";
    }

    function fieldDescription(name: string) {
        let field = indexedFields[name];
        if (field) {
            return field.info || field.description || ''
        }
        return ''
    }

    return <>
        <Modal show={true} onHide={onClose} size="xl">
            <Modal.Header closeButton>
                <div className="d-flex flex-column">
                    <Modal.Title>{category.name}</Modal.Title>
                    <p>{category.description}</p>
                </div>
            </Modal.Header>
            <Modal.Body>
                <p id="excluded">
                    {count !== undefined ?
                        <div>
                            <div>{count} <FormattedMessage id="dq.excluded.count" defaultMessage="records are excluded by this category"/></div>
                            {count > 0 &&
                                <div onClick={() => showOnly()} className="dqLabel mt-2">
                                    <FormattedMessage id="dq.view.excluded" defaultMessage="View excluded records"/>
                                </div>
                            }
                        </div>
                        :
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">...</span>
                        </div>
                    }
                </p>

                <p id="filter-value"><b>Filter applied: </b><i>{catFilter}</i></p>
                {!expanded && count !== undefined && count > 0 && <div
                    title={intl.formatMessage({id:"dq.pop.out", defaultMessage:"Convert this data quality filter into separate filter queries you can include/exclude individually"})}
                    onClick={() => expand()} className="dqLabel">
                    <FormattedMessage id="dq.selectmultiple.buttontext.expandfilters" defaultMessage="Expand and edit filters"/>
                </div>}

                <table
                    className="table cat-table table-bordered table-condensed table-striped mt-4">
                    <tbody>
                    <tr>
                        <th><FormattedMessage id="dq.categoryinfo.dlg.fieldtable.heading.name" defaultMessage="Field name"/></th>
                        <th><FormattedMessage id="dq.categoryinfo.dlg.fieldtable.heading.description" defaultMessage="Description"/></th>
                        <th><FormattedMessage id="dq.categoryinfo.dlg.fieldtable.heading.furtherInfo" defaultMessage="Further information"/></th>
                    </tr>

                    {catFields.map((name, idx) =>
                        <tr key={idx}>
                            <td className="filter-description">
                                {name}
                            </td>
                            <td className="filter-value">
                                {fieldDescription(name)}</td>
                            <td className="filter-wiki">
                                <a href={import.meta.env.VITE_APP_DQ_WIKI_URL + name} target="_blank">
                                    <FormattedMessage id="dq.categoryinfo.dlg.fieldtable.value.link" defaultMessage="Link"/>
                                </a>
                            </td>
                        </tr>
                    )}

                    </tbody>
                </table>

                <table
                    className="table cat-table table-bordered table-condensed table-striped">
                    <tbody>
                    <tr>
                        <th><FormattedMessage id="dq.profiledetail.filtertable.header.description" defaultMessage="Filter description"/></th>
                        <th><FormattedMessage id="dq.profiledetail.filtertable.header.value" defaultMessage="Filter value"/></th>
                        <th><FormattedMessage id="dq.profiledetail.filtertable.header.furtherInfo" defaultMessage="Further information"/></th>
                    </tr>

                    {category.qualityFilters.map((filter, idx) =>
                        <tr key={idx}>
                            <td className="filter-description">
                                {filter.description}
                            </td>
                            <td className="filter-value no-wrap">
                                {filter.filter}</td>
                            <td className="filter-wiki">
                                {infoUrl(filter.filter) &&
                                    <a href={infoUrl(filter.filter) || ''} target="_blank">
                                        <FormattedMessage id="dq.categoryinfo.dlg.fieldtable.value.link" defaultMessage="Link"/>
                                    </a>}
                            </td>
                        </tr>
                    )}

                    </tbody>
                </table>
            </Modal.Body>
            <Modal.Footer>
                <div className="d-flex w-100">
                    <a href={import.meta.env.VITE_APP_DQ_INFO_URL} target="_blank">
                        <FormattedMessage id="dq.warning.dataprofile.buttonleft.text" defaultMessage="Learn More"/>
                    </a>

                    <button className="btn btn-outline-dark ms-auto" onClick={() => onClose()}>
                        <FormattedMessage id="dq.categoryinfo.dlg.closebutton.text" defaultMessage="Close"/>
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualityCategoryInfoModal;
