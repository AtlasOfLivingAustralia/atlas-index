import {useCallback, useContext, useEffect, useState} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"
import Markdown from "markdown-to-jsx";
import UserContext from "../helpers/UserContext.ts";

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
        fetch(import.meta.env.VITE_APP_STATIC_URL + '/api/' + md)
            .then(response => response.text())
            .then(text => setMarkdown(substituteVite(text)));
    }

    function substituteVite(text: string): string {
        return text.replace(/env.VITE_APP_BIOCACHE_URL/g, import.meta.env.VITE_APP_BIOCACHE_URL);
    }

    // Create the layout component
    // class OperationsLayout extends React.Component {
    //     render() {
    //         // @ts-ignore
    //         const { getComponent } = this.props
    //         const Operations = getComponent("operations", true)
    //         return (
    //             <div className="swagger-ui">
    //                 <Operations />
    //             </div>
    //         )
    //     }
    // }
    // Create the plugin that provides our layout component
    // const OperationsLayoutPlugin = () => {
    //     return {
    //         components: {
    //             OperationsLayout: OperationsLayout
    //         }
    //     }
    // }

    // const requestInterceptor = (req: any) => (
    //     {
    //         ...req,
    //         headers: (currentUser?.user.access_token && req.url !== swaggerUrl) ? {
    //             ...req.headers,
    //             'Authorization': 'Bearer ' + currentUser?.user.access_token,
    //         } : {}
    //     }
    // );
    //
    // function onCompleteSwaggerUI() {
    //     console.log('swagger loaded')
    //     // setSwaggerLoaded(true);
    // }

    // TODO: requires >= swagger-ui-react 5.17.3, so might need to wait a few days
    const handleComplete = useCallback((swagger: any) => {
        console.log('swagger loaded, setting preauthorizeApiKey')
        if (currentUser?.user.access_token) {
            swagger.preauthorizeApiKey('bearer', currentUser?.user.access_token);
        }
    }, []);

    // useEffect(() => {
    //     // Your "componentDidUpdate" logic here. This code will run when `swaggerUrl` or `markdown` changes.
    //     console.log(swaggerUrl);
    // }, [swaggerUrl]);


    // componentDidUpdate(prevProps: any, prevState: any) {
    //     componentDidUpdate(prevProps, prevState) {
    //         if (this.props.data !== prevProps.data) {
    //             console.log(this.props.data);
    //         }
    //     }
    // }

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
                                        // plugins={ [ OperationsLayoutPlugin ]}
                                        // layout={"OperationsLayout"}
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
