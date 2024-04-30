import UserContext from "../helpers/UserContext.ts";
import React, {useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"
import Markdown from "markdown-to-jsx";

function Api({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [swaggerUrl, setSwaggerUrl] = useState('');
    const [markdown, setMarkdown] = useState('');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'API', href: '/swagger'}
        ]);

        updateMarkdown('intro.md')
    }, []);

    const currentUser = useContext(UserContext) as ListsUser;

    function updateMarkdown(md: string) {
        console.log("fetching: " + md)
        fetch(import.meta.env.VITE_APP_STATIC_URL + '/api/' + md)
            .then(response => response.text())
            .then(text => setMarkdown(substituteVite(text)));
    }

    function substituteVite(text: string): string {
        return text.replace(/env.VITE_APP_BIOCACHE_URL/g, import.meta.env.VITE_APP_BIOCACHE_URL);
    }

    // Create the layout component
    class OperationsLayout extends React.Component {
        render() {
            // @ts-ignore
            const { getComponent } = this.props
            const Operations = getComponent("operations", true)
            return (
                <div className="swagger-ui">
                    <Operations />
                </div>
            )
        }
    }
    // Create the plugin that provides our layout component
    const OperationsLayoutPlugin = () => {
        return {
            components: {
                OperationsLayout: OperationsLayout
            }
        }
    }

    return (
        <>
            <div className="container-fluid">
                {!currentUser?.isAdmin &&
                    <p>User {currentUser?.user?.profile?.name} is not authorised to access these tools.</p>
                }
                {currentUser?.isAdmin &&
                    <>
                        <div className="row">
                            <div className="col col-2">
                                <div className="d-flex flex-column border border-black p-3">
                                    <ul className="list-unstyled">
                                        <li className="mt-2">
                                            <a onClick={() => {
                                                setSwaggerUrl('');
                                                updateMarkdown('intro.md');
                                            }}
                                               className="">API Introduction</a>
                                        </li>
                                        <li className="mt-2">
                                            <a onClick={() => {
                                                setSwaggerUrl(import.meta.env.VITE_ATLAS_OPENAPI);
                                                updateMarkdown('atlas-search.md');
                                            }}
                                               className="">Atlas API</a>
                                        </li>
                                        <li className="mt-2">
                                            <a onClick={() => {
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
                                {swaggerUrl &&
                                    // TODO: fetch the spec and provide it to the component.
                                    //  This way we can get things like the version so we can display it.
                                    <SwaggerUI url={swaggerUrl} plugins={ [ OperationsLayoutPlugin ]} layout={"OperationsLayout"}/>
                                }
                            </div>

                        </div>
                    </>
                }
            </div>
        </>
    );
}

export default Api;
