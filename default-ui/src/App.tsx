import {Link, Route, Routes, useLocation} from "react-router-dom";
import {Breadcrumb, ListsUser} from "./api/sources/model";
import React, {useEffect, useState} from "react";
import UserContext from "./helpers/UserContext.ts";
import {useAuth} from "react-oidc-context";
import 'bootstrap/dist/css/bootstrap.css';
import Home from "./views/Home.tsx"
import AtlasAdmin from "./views/AtlasAdmin.tsx"
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import DataQualityAdmin from "./views/DataQualityAdmin.tsx";
import {User} from "oidc-client-ts";
import OccurrenceSearch from "./views/OccurrenceSearch.tsx";
import OccurrenceList from "./views/OccurrenceList.tsx";
import "@fontsource/roboto";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import Occurrence from "./views/Occurrence.tsx";
import {cacheFetchText} from "./helpers/CacheFetch.tsx";

const alreadyLoaded: string[] = [];

// Pass the query string to the App, for later use by components that need it.
function useQuery() {
    const {search, state} = useLocation();

    // if we have a state, use the state
    if (state?.params) {
        return React.useMemo(() => new URLSearchParams(state?.params), [state?.params?.query]);
    } else {
        return React.useMemo(() => new URLSearchParams(search), [search]);
    }
}

export default function App() {

    const [currentUser, setCurrentUser] = useState<ListsUser | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [queryString, setQueryString] = useState(useQuery().toString());
    const [externalHeaderHtml, setExternalHeaderHtml] = useState('');
    const [externalFooterHtml, setExternalFooterHtml] = useState('');

    const auth = useAuth();
    const location = useLocation();

    useEffect(() => {
        const handlePopState = (event: any) => {
            if (event.state?.query === undefined) {
                // use the query string from the location when the history is not available
                const {search} = location;
                if (search?.startsWith('?')) {
                    setQueryString(search.substring(1));
                } else {
                    setQueryString(search)
                }
            } else {
                setQueryString(event.state?.query)
            }
        };

        window.addEventListener('popstate', handlePopState);

        const handleHashChange = () => {
            let search = window.location.search + window.location.hash || ''
            let pos = search.indexOf('?');
            if (search.length > pos) {
                setQueryString(search.substring(pos + 1))
            } else {
                setQueryString('')
            }
        };

        window.addEventListener('hashchange', handleHashChange);

        // The header "dark mode" is a problem, because it feels like too much work for an admin page.
        // Attempt to set it to light mode; see the header's application.js
        localStorage.setItem('theme', "light");
        cacheFetchText(import.meta.env.VITE_HTML_EXTERNAL_HEADER_URL, {
            method: 'GET'
        }, null).then(text => {
            var noScriptText = headerFooterProcessing(import.meta.env.VITE_HTML_EXTERNAL_HEADER_URL, text);
            setExternalHeaderHtml(noScriptText);

            // Begin processing footer only when header is finished
            cacheFetchText(import.meta.env.VITE_HTML_EXTERNAL_FOOTER_URL, {
                method: 'GET'
            }, null).then(text => {
                var noScriptText = headerFooterProcessing(import.meta.env.VITE_HTML_EXTERNAL_FOOTER_URL, text);
                setExternalFooterHtml(noScriptText);

                var remainderText = '';
                var extraJs = import.meta.env.VITE_HEADER_JS;
                if (extraJs) {
                    // split extraJs by comma and load each script
                    for (const js of extraJs.split(',')) {
                        remainderText += '<script src=\"' + js + '\"></script>';
                    }
                }

                headerFooterProcessing(import.meta.env.VITE_HTML_EXTERNAL_HEADER_URL, remainderText);
            });
        });

        // Cleanup when the component is unmounted
        // return () => {
        //     console.log("remove popstate listener")
        //     window.removeEventListener('popstate', handlePopState);
        // };
    }, []);

    // This helps usage of 'navigate("path?params")' pick up the params
    useEffect(() => {
        let search = window.location.search + window.location.hash || ''
        let pos = search.indexOf('?');
        if (pos >= 0) {
            setQueryString(search.substring(pos + 1))
        } else {
            setQueryString('')
        }
    }, [location]);

    // Update the external header logined/logged out status should the currentUser or externalHeaderHtml change
    useEffect(() => {
        const signedOutElements = document.querySelectorAll('div.signedOut');
        if (currentUser?.isAdmin()) {
            signedOutElements.forEach(element => {
                element.classList.remove('signedOut');
                element.classList.add('signedIn');
            });
        }
    }, [currentUser, externalHeaderHtml])

    // const breadcrumbItems = breadcrumbMap.map(item => item.title);
    const breadcrumbItems = breadcrumbs.map((breadcrumb: Breadcrumb, index) => {
        return (
            <li className="breadcrumb-item" key={index}>
                {index < breadcrumbs.length - 1 ? (
                    <Link to={breadcrumb.href ? breadcrumb.href : '#'}>{breadcrumb.title}</Link>
                ) : (
                    <>
                        {breadcrumb.title}
                    </>
                )
                }
            </li>);
    });

    if (auth.error) {
        return <div>Configuration error... {auth.error.message}</div>;
    }

    const myProfile = () => {
        window.location.href = import.meta.env.VITE_OIDC_AUTH_PROFILE
    };

    const logout = () => {
        auth.signoutRedirect({
            extraQueryParams: {
                client_id: auth.settings.client_id,
                logout_uri: import.meta.env.VITE_OIDC_REDIRECT_URL
            }
        });

        // TODO: update header css "signedIn" class to "signedOut"
    };

    function headerFooterProcessing(sourceUrl: string, text: string) : string {
        // do substitutions of the template
        text = text.replace(/::loginURL::/g, "\" disabled=\"disabled");
        text = text.replace(/::logoutURL::/g, "\" disabled=\"disabled");
        text = text.replace(/::searchServer::/g, import.meta.env.VITE_SEARCH_SERVER_URL);

        // This might do nothing because currentUser is likely undefined at this point
        if (currentUser?.isAdmin()) {
            text = text.replace(/::loginStatus::/g, "signedIn");
        } else {
            text = text.replace(/::loginStatus::/g, "signedOut");
        }

        // This is a potential issue if relative paths are not substituted correctly because the app base url is
        // used first and this can prevent the css being applied correctly.
        var baseUrl = sourceUrl.replace(/\/[^/]*$/, "/");
        text = text.replace(/<img src="img\//g, "<img src=\"" + baseUrl + "img/");

        var noScriptText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

        loadJavascript(text)

        return noScriptText;
    }
    function getUser(): User | null | undefined {
        return auth.user
    }

    function getRoles(): string [] {
        return (auth.user?.profile[import.meta.env.VITE_PROFILE_ROLES] || []) as string[];
    }

    function getUserId(): string {
        return (auth.user?.profile[import.meta.env.VITE_PROFILE_USERID]) as string || '';
    }

    function isAdmin(): boolean {
        return getRoles().includes(import.meta.env.VITE_ADMIN_ROLE);
    }

    function isLoading(): boolean {
        return auth.isLoading;
    }

    if (auth.isAuthenticated && auth.user && !currentUser) {
        setCurrentUser({
            user: getUser,
            userId: getUserId,
            isAdmin: isAdmin,
            roles: getRoles,
            isLoading: isLoading
        });
    }

    function login() {
        void auth.signinRedirect({
            // this is used by onSigninCallback to redirect back to the original page
            state: {from: location.pathname + location.search + location.hash}
        })
    }

    // Intercepts header and footer clicks to handle login and logout
    function clickHandler(e: any) {
        if (e.target.classList.contains('ala-header-button-sign-in')) {
            if (login) {
                login();
            }
            e.preventDefault()
        } else if (e.target.classList.contains('ala-header-button-sign-out')) {
            if (logout) {
                logout();
            }
            e.preventDefault()
        }
    }

    // Loads the text and any inline or remote scripts correctly.
    function loadJavascript(text: string) {
        var srcUrl;
        var srcText;
        var script1 = text.match(/(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>)/g);
        if (script1 && script1.length > 0) {
            text = text.replace(script1[0], "");
            var srcMatches = script1[0].match(/src=["']([^'"]*)/)
            if (srcMatches && srcMatches.length > 1) {
                srcUrl = srcMatches[1]
            } else {
                // get inner script
                var txt = script1[0].match(/<script[^>]*>([\s\S]*?)<\/script>/i);
                if (txt && txt.length > 1) {
                    srcText = txt[1]
                }
            }
        }

        if (srcUrl) {
            if (alreadyLoaded.indexOf(srcUrl) < 0) {
                const script = document.createElement("script");
                script.src = srcUrl;
                script.async = true;
                script.onload = () => loadJavascript(text);
                document.body.appendChild(script);

                alreadyLoaded.push(srcUrl);
            }
        } else if (srcText) {
            if (alreadyLoaded.indexOf(srcText) < 0) {
                const script = document.createElement("script");
                script.innerHTML = srcText;
                script.async = true;
                script.onload = () => loadJavascript(text);
                document.body.appendChild(script);

                alreadyLoaded.push(srcText);
            }
        }
    }

    return (
        <UserContext.Provider value={currentUser}>
            <main>
                {/*the default header when there is no external header*/}
                {!externalHeaderHtml &&
                    <header className="bg-black" style={{paddingBottom: "26px", paddingTop: "15px"}}>
                        <div className="container-fluid">
                            <div className="d-flex gap-3">
                                <div className="">
                                    <a href="/" className="">
                                        <img className="logoImage" src={import.meta.env.VITE_LOGO_URL} alt="ALA logo"
                                             width={'335px'} style={{marginTop: '10px', marginLeft: '14px'}}/>
                                    </a>
                                </div>

                                <div className="d-flex ms-auto align-items-center">
                                    <ul className="nav">
                                        <li>
                                            <a href="https://www.ala.org.au/contact-us/" target="_blank"
                                               className="nav-link text-white">Contact us</a>
                                        </li>
                                    </ul>
                                </div>
                                <div className="vr d-flex text-white"></div>
                                <div className="d-flex align-items-center">
                                    {currentUser ? (
                                        <>
                                            <button type="button" onClick={myProfile}
                                                    className="btn text-white border-white text-end">
                                                Profile
                                                - {currentUser?.user()?.profile?.name || (currentUser?.user()?.profile?.given_name + ' ' + currentUser?.user()?.profile?.family_name)} {currentUser?.isAdmin() ? '(ADMIN)' : ''}
                                            </button>
                                            <button type="button" onClick={logout}
                                                    className="btn text-white border-white text-end">Logout
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => login()}
                                                    className="btn text-white border-white text-end">Login
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                }

                {externalHeaderHtml &&
                    <div onClick={clickHandler}
                         dangerouslySetInnerHTML={{__html: externalHeaderHtml}}></div>
                }

                <div className="mt-0"/>

                <section id="breadcrumb">
                    <div className="container-fluid">
                        <div className="row">
                            <nav aria-label="Breadcrumb" role="navigation">
                                <ol className="breadcrumb-list breadcrumb">
                                    {breadcrumbItems}
                                </ol>
                            </nav>
                        </div>
                    </div>
                </section>

                {currentUser && currentUser.isAdmin() &&
                    <Routes>
                        <Route path="/"
                               element={<Home setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/atlas-admin"
                               element={<AtlasAdmin setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/data-quality-admin" element={<DataQualityAdmin
                            setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/occurrence-search"
                               element={<OccurrenceSearch
                                   setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                        <Route path="/occurrence-list"
                               element={<OccurrenceList setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                                        queryString={queryString} setQueryString={setQueryString}/>}/>
                        <Route path="/occurrence"
                               element={<Occurrence setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                                    queryString={queryString}/>}/>
                    </Routes>
                }
                {(!currentUser || !currentUser.isAdmin()) &&
                    <div className="d-flex justify-content-center py-5">Admin login required</div>
                }

                {externalFooterHtml &&
                    <div onClick={clickHandler}
                         dangerouslySetInnerHTML={{__html: externalFooterHtml}}></div>
                }

                <link rel="stylesheet" type="text/css"
                      href={import.meta.env.VITE_CSS_EXTERNAL_TEST}/>
            </main>
        </UserContext.Provider>
    );
}

