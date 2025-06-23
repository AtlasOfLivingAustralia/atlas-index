import {Link, useNavigate} from "react-router-dom";
import {useState} from "react";
import AlertModal from "./alertModal.tsx";

interface RecordsViewProps {
    results: {},
    pageSize: number,
    setPageSize: (pageSize: number) => void,
    sort: string,
    setSort: (value: (((prevState: string) => string) | string)) => void,
    dir: string,
    setDir: (value: (((prevState: string) => string) | string)) => void,
    page: number,
    setPage: (page: number) => void,
    queryString?: string
}

function RecordsView({
                         results,
                         pageSize,
                         setPageSize,
                         sort,
                         setSort,
                         dir,
                         setDir,
                         page,
                         setPage,
                         queryString
                     }: RecordsViewProps) {

    const navigate = useNavigate();
    const [showAlerts, setShowAlerts] = useState(false);

    function formatDate(date: number) {
        let d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    function openOccurrence(id: string) {
        navigate("/occurrence?id=" + id)
    }

    return <>
        <div id="searchControls" className="row align-items-center">
            <div className="col-sm-4 col-md-4">
                <button className="btn border-black btn-sm" title="Get email alerts for this search"
                        onClick={() => setShowAlerts(true)}>
                    <i className="bi bi-bell-fill me-1"></i>Alerts
                </button>
            </div>

            <div id="sortWidgets" className="col-sm-8 col-md-8">
                <div className="d-flex">
                    <span className="ms-auto"></span>
                    <span className="hidden-sm">per&nbsp;</span>page:
                    <select id="per-page" name="per-page" className="input-small me-2 ms-1"
                            value={pageSize}
                            onChange={(e) => setPageSize(parseInt(e.target.value) || 20)}>
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>&nbsp;
                    sort:
                    <select id="sort" name="sort" className="input-small me-2 ms-1"
                            value={sort}
                            onChange={(e) => setSort(e.target.value || 'first_loaded_date')}>
                        <option value="score">Best match</option>
                        <option value="taxon_name">Taxon name</option>
                        <option value="common_name">Common name</option>
                        <option value="occurrence_date">Record date</option>
                        <option value="record_type">Record type</option>
                        <option value="first_loaded_date">Date added</option>
                        <option value="last_assertion_date">Last annotated</option>
                    </select>&nbsp;
                    order:
                    <select id="dir" name="dir" className="input-small ms-1"
                            value={dir}
                            onChange={(e) => setDir(e.target.value || 'desc')}>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="results" className="row mt-3">
            <div className="col-sm-12 col-md-12">
                <div className="container" id="resultsContainer">
                    <div className="row">
                        <div className="col-sm-12 col-md-12">
                            {/*@ts-ignore*/}
                            {results.occurrences && results.occurrences.map((result: any, idx) =>
                                <div key={idx} id={result.uuid} onClick={() => openOccurrence(result.uuid)}>
                                    <p className="rowA">
                                        <span style={{textTransform: "capitalize"}}>Genus</span>:&nbsp;
                                        <span className="occurrenceNames"><i
                                            style={{fontWeight: "normal"}}>{result.genus}</i></span>
                                        {result.vernacularName && <>
                                            &nbsp;|&nbsp;<span
                                            className="occurrenceNames">{result.vernacularName}</span>
                                        </>
                                        }
                                        {result.eventDate && <span className="resultValue ms-2">
                                                <span
                                                    className="resultsLabel">Date: </span>{formatDate(result.eventDate)}
                                            </span>
                                        }
                                        {!result.eventDate && result.year && <span className="resultValue ms-2">
                                                <span
                                                    className="resultsLabel">Year: </span>{formatDate(result.year)}
                                            </span>}
                                        {result.country &&
                                            <span className="resultValue ms-2">
                                                 <span className="resultsLabel">Country: </span>{result.country}
                                               </span>
                                        }
                                    </p>
                                    <p className="rowB">
                                            <span className="resultValue">
                                                <span className="resultsLabel">Data resource: </span>NORFANZ Biological Survey, Tasman Sea, Australia - New Zealand 2003
                                            </span>
                                        {result.basisOfRecord &&
                                            <span className="resultValue ms-2">
                                                  <span
                                                      className="resultsLabel">Basis of record: </span>{result.basisOfRecord}
                                                </span>
                                        }
                                        {result.raw_catalogNumber &&
                                            <span className="resultValue ms-2">
                                                  <span
                                                      className="resultsLabel">Catalogue Number: </span>{result.raw_catalogNumber}
                                                </span>
                                        }

                                        <span className="resultsLabel ms-2">
                                                <Link to={`/occurrences/${result.uuid}`}>View record</Link>
                                            </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="row mt-3">
            <div className="col-12">
                <div className="d-flex justify-content-center">
                    {page > 1 && <button className="btn border-black btn-sm ms-1" onClick={() => setPage(page - 1)}>
                        <i className="bi bi-chevron-double-left" style={{fontSize: "11px"}}></i> Previous
                    </button>}

                    <button className="btn border-black btn-sm ms-1" onClick={() => setPage(1)}
                            disabled={page == 1}>1
                    </button>

                    {/*@ts-ignore*/}
                    {Array.from(Array(9).keys()).map((idx) => {
                        // rendering from page-4 to page +4
                        let lowerBound = Math.max(2, page - 4)
                        // let upperBound = Math.min(20, page + 4)
                        // @ts-ignore
                        let maxPages = Math.ceil(results.totalRecords / pageSize);
                        let p = lowerBound + idx
                        if (p <= 20 && p <= maxPages) {
                            return <div key={idx}>
                                {lowerBound > 2 && idx == 0 &&
                                    <button className="btn border-black btn-sm ms-1">..</button>}
                                <button key={idx} className="btn border-black btn-sm ms-1" disabled={page == p}
                                        onClick={() => setPage(p)}>{p}</button>
                            </div>
                        } else {
                            return <div key={idx}></div>
                        }

                    })}

                    {/*@ts-ignore*/}
                    {(page * pageSize < results.totalRecords && Math.min(20, page + 4) < Math.ceil(results.totalRecords / pageSize)) &&
                        <button className="btn border-black btn-sm ms-1">..</button>
                    }

                    {/*@ts-ignore*/}
                    {(page * pageSize < results.totalRecords && page < 20) &&
                        <button className="btn border-black btn-sm ms-1" onClick={() => setPage(page + 1)}>
                            Next <i className="bi bi-chevron-double-right" style={{fontSize: "11px"}}></i></button>}
                </div>
            </div>
        </div>

        {showAlerts && <AlertModal onClose={() => setShowAlerts(false)} results={results} queryString={queryString}/>}
    </>
}

export default RecordsView;

{/*<AlertModal />*/
}
