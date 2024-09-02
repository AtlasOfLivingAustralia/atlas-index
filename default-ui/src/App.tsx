import {Link, Route, Routes, useLocation} from "react-router-dom";
import {Breadcrumb, ListsUser} from "./api/sources/model";
import React, {MouseEventHandler, useEffect, useState} from "react";
import {useAuth} from "react-oidc-context";
import {User} from "oidc-client-ts";
import { Footer, Header, IndigenousAcknowledgement } from "ala-mantine";
import { Anchor, Box, Container, Divider, Space, } from "@mantine/core";

import UserContext from "./helpers/UserContext.ts";
import Home from "./views/Home.tsx"
import Dashboard from "./views/Dashboard.tsx"
import AtlasAdmin from "./views/AtlasAdmin.tsx"
import Vocab from "./views/Vocab.tsx";
import AtlasIndex from "./views/AtlasIndex.tsx";
import Api from "./views/Api.tsx";
import MapView from "./views/Map.tsx";
import DataQualityAdmin from "./views/DataQualityAdmin.tsx";
import OccurrenceSearch from "./views/OccurrenceSearch.tsx";
import OccurrenceList from "./views/OccurrenceList.tsx";
import Occurrence from "./views/Occurrence.tsx";
import Species from "./views/Species.tsx";
import BreadcrumbSection from "./components/header/breadcrumbs.tsx";

import "@fontsource/roboto";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import '@mantine/core/styles.css';
import classes from './App.module.css';

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
            <>
                {index < breadcrumbs.length - 1 ? (
                    <Anchor component={Link} to={breadcrumb.href ? breadcrumb.href : '#'}>{breadcrumb.title}</Anchor>
                ) : (
                    <>
                        {breadcrumb.title}
                    </>
                )
                }
            </>
        );
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
            <Header 
                onAuthClick={login} 
                isAuthenticated={currentUser ? true : false}
            />
             { breadcrumbItems.length > 0 && // Some pages don't have breadcrumbs or include them in the page
                <Box className={classes.header}>
                    <Container py="lg" size="lg">
                        <BreadcrumbSection breadcrumbValues={breadcrumbs} />    
                    </Container>
                </Box> 
            }
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
                <Route path="/species"
                    element={<Species setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}
                                            queryString={queryString}/>}/>
            </Routes>
            <Space h="xl" />
            <Divider />
            <Footer />
            <IndigenousAcknowledgement />
        </UserContext.Provider>
    );
}

