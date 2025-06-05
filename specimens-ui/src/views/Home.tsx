/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect} from "react";
import {Link} from "react-router-dom";
import {Breadcrumb} from "../api/sources/model.ts";

// interface Collection {
//     uid: string;
//     name: string;
//     institution?: { name: string };
//     displayCollectionImage: string;
//     pubDescription: string;
// }

import collectionsData from "../api/sources/collections.json";

interface HomeProps {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void
}

/**
 * Home page. Lists some collections.
 *
 * @param setBreadcrumbs
 * @constructor
 */
function Home({setBreadcrumbs}: HomeProps) {

    useEffect(() => {
        setBreadcrumbs([
            {title: "Home", href: import.meta.env.VITE_HOME_URL},
            {title: "Images of specimens | Atlas of Living Australia", href: ""}
        ])
    }, []);

    return (
        <div className="container-fluid" >
            <div>
                <div style={{height: "25px"}}/>
                <span style={{fontSize: "36px", fontWeight: "500"}}>Images of specimens from Australia’s Natural History Collections</span>
                <p style={{fontSize: "21px", fontWeight: "300", marginTop: "4px"}}>
                    Images from Australia's Natural History collections made available by the museums and herbaria of
                    Australia.
                    <br/>
                    To view images from all collections, <Link to="/browse">click here</Link>.
                </p>
                <hr style={{marginTop: "30px", color: "#212121"}}/>
            </div>

            <div className="row">
                {collectionsData.map((collection) => (
                    <div className="col-12 col-md-4" key={collection.uid}>
                        <div className="thumbnail" style={{ border: "1px solid black", borderRadius: "5px", margin: "10px", padding: "10px" }}>
                            <h2>
                                <Link to={`/browse/${collection.uid}`}>{collection.name}</Link>
                            </h2>
                            {collection.institution && <h3>{collection.institution.name}</h3>}
                            <Link to={`/browse/${collection.uid}`}>
                                <img className="img-fluid" src={collection.displayCollectionImage} alt={collection.name} />
                            </Link>
                            <p className="panel-text">
                                {collection.pubDescription}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Home;
