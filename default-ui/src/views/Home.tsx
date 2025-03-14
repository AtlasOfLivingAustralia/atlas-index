import {useEffect} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {Link} from "react-router-dom";

function Home({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    login?: () => void,
    logout?: () => void
}) {

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'}
        ]);
    }, []);

    return (
        <>
            <div className="container-fluid">
                <>
                    <table className="table table-bordered mt-5">
                        <tbody>
                        <tr>
                            <td>
                                <Link to="/atlas-admin">Search Index</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Update search index with names-index and other data sources.</li>
                                    <li>View search index's admin logs.</li>
                                    <li>Edit taxon records for preferred images, hidden images and descriptions.</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Link to="/data-quality-admin">Data Quality</Link>
                            </td>
                            <td>
                                <ul>
                                    <li>Edit data quality profiles</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td>Occurrences (mockup)</td>
                            <td>
                                <ul>
                                    <li><Link to="/occurrence-search">Search Page</Link></li>
                                    <li><Link to="/occurrence-list?q=forg&qualityProfile=ALA">Search Result Page</Link>
                                    </li>
                                    <li><Link to="/occurrence?id=5a3f4768-0c28-4c56-9814-1e32a3f35aec">Occurrence
                                        page</Link></li>
                                </ul>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </>
                {/*}*/}
            </div>
        </>
    );
}

export default Home;
