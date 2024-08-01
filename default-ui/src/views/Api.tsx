import {useCallback, useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import SwaggerUI from "swagger-ui-react"
// import "swagger-ui-react/swagger-ui.css?inline"
import Markdown from "markdown-to-jsx";
import UserContext from "../helpers/UserContext.ts";
import {cacheFetchText} from "../helpers/CacheFetch.tsx";

function Api({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const currentUser = useContext(UserContext) as ListsUser;
    const [swaggerUrl, setSwaggerUrl] = useState('');
    const [swaggerLoaded, setSwaggerLoaded] = useState(false);
    const [markdown, setMarkdown] = useState('');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'API', href: '/swagger'}
        ]);

        updateMarkdown('intro.md')
    }, []);

    function updateMarkdown(md: string) {
        cacheFetchText(import.meta.env.VITE_APP_STATIC_URL + '/api/' + md, {}, null)
            .then(text => setMarkdown(substituteVite(text)));
    }

    function substituteVite(text: string): string {
        return text.replace(/env.VITE_APP_BIOCACHE_URL/g, import.meta.env.VITE_APP_BIOCACHE_URL);
    }

    const handleComplete = useCallback((swagger: any) => {
        if (currentUser?.user()?.access_token) {
            swagger.preauthorizeApiKey('bearer', currentUser?.user()?.access_token);
        }
    }, []);

    return (
        <>
            <div className="container-fluid">
                <>
                    <div className="row">
                        <div className="col col-2">
                            <div className="d-flex flex-column border border-black p-3">
                                <ul className="list-unstyled">
                                    <li className="mt-2">
                                        <a onClick={() => {
                                            setSwaggerLoaded(false);
                                            updateMarkdown('intro.md');
                                        }}
                                           className="">API Introduction</a>
                                    </li>
                                    <li className="mt-2">
                                        <a onClick={() => {
                                            setSwaggerLoaded(true);
                                            setSwaggerUrl(import.meta.env.VITE_ATLAS_OPENAPI);
                                            updateMarkdown('atlas-search.md');
                                        }}
                                           className="">Atlas API</a>
                                    </li>
                                    <li className="mt-2">
                                        <a onClick={() => {
                                            setSwaggerLoaded(true);
                                            setSwaggerUrl(import.meta.env.VITE_BIOCACHE_OPENAPI);
                                            updateMarkdown('biocache.md');
                                        }}
                                           className="">Biocache API</a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="col">
                            <Markdown>{markdown}</Markdown>
                            <br/>
                            {swaggerLoaded &&
                                // TODO: fetch the spec and provide it to the component.
                                //  This way we can get things like the version so we can display it.
                                <SwaggerUI
                                    url={swaggerUrl}
                                    onComplete={handleComplete}
                                />
                            }
                        </div>

                    </div>
                </>
            </div>
        </>
    );
}

export default Api;
