import {Link, Route, Routes, useLocation} from "react-router-dom";
import {Breadcrumb, ListsUser} from "./api/sources/model";
import React, {useEffect, useState} from "react";
import UserContext from "./helpers/UserContext.ts";
import {useAuth} from "react-oidc-context";
import 'bootstrap/dist/css/bootstrap.css';
import Home from "./views/Home.tsx"
import Dashboard from "./views/Dashboard.tsx"
import AtlasAdmin from "./views/AtlasAdmin.tsx"
import Vocab from "./views/Vocab.tsx";
import AtlasIndex from "./views/AtlasIndex.tsx";
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import Api from "./views/Api.tsx";
import MapView from "./views/Map.tsx";
import "bootstrap-icons/font/bootstrap-icons.css";
import DataQualityAdmin from "./views/DataQualityAdmin.tsx";
import {User} from "oidc-client-ts";
import OccurrenceSearch from "./views/OccurrenceSearch.tsx";
import OccurrenceList from "./views/OccurrenceList.tsx";
import "@fontsource/roboto";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import Occurrence from "./views/Occurrence.tsx";

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

        const handleHashChange = (event: any) => {
            console.log(event)
            let search = window.location.search + window.location.hash || ''
            let pos = search.indexOf('?');
            if (search.length > pos) {
                setQueryString(search.substring(pos + 1))
            } else {
                setQueryString('')
            }
        };

        window.addEventListener('hashchange', handleHashChange);

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
    };

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

    return (
        <UserContext.Provider value={currentUser}>
            <main>
                {/*<Modal title="About" opened={auth.isLoading} onClose={() => console.log("auth checked")}>*/}
                {/*    <Group>*/}
                {/*        <Loader color="orange"/>*/}
                {/*        <Text>Logging in...</Text>*/}
                {/*    </Group>*/}
                {/*</Modal>*/}
            </main>
            <main>
                <header className="bg-black" style={{paddingBottom: "26px", paddingTop: "15px"}}>
                    <div className="container-fluid">
                        <div className="d-flex gap-3">
                            <div className="">
                                <a href="/" className="">
                                    <img className="logoImage" src={import.meta.env.VITE_LOGO_URL} alt="ALA logo"
                                         width={'335px'} style={{marginTop: '10px', marginLeft: '14px'}}/>
                                </a>
                            </div>

                            {/*<form className="col-12 col-lg-auto mb-3 mb-lg-0 me-lg-3">*/}
                            {/*    <input type="search" className="form-control form-control-dark" placeholder="Search..."*/}
                            {/*           aria-label="Search"/>*/}
                            {/*</form>*/}
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

                <div className="mt-1"/>

                <Routes>
                    <Route path="/" element={<Home setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                                   login={() => login()} logout={() => logout()}/>}/>
                    <Route path="/dashboard"
                           element={<Dashboard setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/atlas-admin"
                           element={<AtlasAdmin setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/data-quality-admin" element={<DataQualityAdmin
                        setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/vocab"
                           element={<Vocab setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/atlas-index"
                           element={<AtlasIndex setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/api"
                           element={<Api setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/map"
                           element={<MapView setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
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

            </main>
        </UserContext.Provider>
    );
}

