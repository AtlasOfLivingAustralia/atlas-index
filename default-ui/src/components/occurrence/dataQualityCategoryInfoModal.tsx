import Modal from "react-bootstrap/esm/Modal";
import {DataQualityInfo, IndexFields, QualityCategory} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import {cacheFetchJson} from "../../helpers/CacheFetch.tsx";

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
        cacheFetchJson(import.meta.env.VITE_APP_INDEX_FIELDS_URL, {}, null).then(json => {
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
            let thisQueryString = queryString + "&disableAllQualityFilters=true&fq=" + category.inverseFilter;

            cacheFetchJson(import.meta.env.VITE_APP_BIOCACHE_URL + "/occurrences/search?" + thisQueryString, {}, null)
                .then(data => setCount(data.totalRecords));
        }
    }

    function infoUrl(fq: string) {
        let match = fq.match(/-?assertions:(\w+)/);
        if (match && match.length > 1) {
            return "https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + match[1];
        }

        match = fq.match(/-?(\w+):/);
        if (match && match.length > 1) {
            return "https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + match[1];
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
                            <div>{count} records are excluded by this category</div>
                            {count > 0 &&
                                <div onClick={() => showOnly()} className="dqLabel mt-2">View excluded
                                    records
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
                    title="Convert this data quality filter into separate filter queries you can include/exclude individually"
                    onClick={() => expand()} className="dqLabel">Expand and edit filters
                </div>}

                <table
                    className="table cat-table table-bordered table-condensed table-striped mt-4">
                    <tbody>
                    <tr>
                        <th>Field name</th>
                        <th>Description</th>
                        <th>Further information</th>
                    </tr>

                    {/*@ts-ignore*/}
                    {catFields.map((name, idx) =>
                        <tr key={idx}>
                            <td className="filter-description">
                                {name}
                            </td>
                            <td className="filter-value">
                                {fieldDescription(name)}</td>
                            <td className="filter-wiki">
                                <a href={"https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + name} target="_blank">Link</a>
                            </td>
                        </tr>
                    )}

                    </tbody>
                </table>

                <table
                    className="table cat-table table-bordered table-condensed table-striped">
                    <tbody>
                    <tr>
                        <th>Filter description</th>
                        <th>Filter value</th>
                        <th>Further information</th>
                    </tr>

                    {/*@ts-ignore*/}
                    {category.qualityFilters.map((filter, idx) =>
                        <tr key={idx}>
                            <td className="filter-description">
                                {filter.description}
                            </td>
                            <td className="filter-value no-wrap">
                                {filter.filter}</td>
                            <td className="filter-wiki">
                                {infoUrl(filter.filter) &&
                                    <a href={infoUrl(filter.filter) || ''} target="_blank">Link</a>}
                            </td>
                        </tr>
                    )}

                    </tbody>
                </table>
            </Modal.Body>
            <Modal.Footer>
                <div className="d-flex w-100">
                    <a href="https://support.ala.org.au/support/solutions/articles/6000240256-getting-started-with-the-data-quality-filters"
                       target="_blank">Learn More</a>

                    <button className="btn btn-default btn-sm border-black ms-auto" onClick={() => onClose()}>Close
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualityCategoryInfoModal;
