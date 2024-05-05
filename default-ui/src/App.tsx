import {Link, Route, Routes} from "react-router-dom";
import {Breadcrumb, ListsUser} from "./api/sources/model";
import {useState} from "react";
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

export default function App() {

    const [currentUser, setCurrentUser] = useState<ListsUser | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>( []);
    const auth = useAuth();

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

    if (auth.isAuthenticated && auth.user && !currentUser) {
        // set the current user
        const user = auth.user;
        const roles = (user?.profile[import.meta.env.VITE_PROFILE_ROLES] || []) as string[];
        const userId = (user?.profile[import.meta.env.VITE_PROFILE_USERID]) as string || '';
        setCurrentUser({
            user: auth.user,
            userId: userId,
            isAdmin: roles.includes(import.meta.env.VITE_ADMIN_ROLE),
            roles: roles
        });
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
                <header className="py-3 mb-3 border-bottom bg-black">
                    <div className="container-fluid">
                        <div className="d-flex  gap-3">
                            <div className="">
                                <a href="/" className="">
                                    <img className="logoImage" src={import.meta.env.VITE_LOGO_URL} alt="ALA logo"
                                         width={'335px'} style={{marginTop: '10px', marginLeft: '30px'}}/>
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
                                            - {currentUser?.user?.profile?.name || (currentUser?.user?.profile?.given_name + ' ' + currentUser?.user?.profile?.family_name)} {currentUser?.isAdmin ? '(ADMIN)' : ''}
                                        </button>
                                        <button type="button" onClick={logout}
                                                className="btn text-white border-white text-end">Logout
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => void auth.signinRedirect()}
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
                    <Route path="/" element={<Home setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)} signinRedirect={() => auth.signinRedirect()} logout={() => logout()}/>}/>
                    <Route path="/dashboard" element={<Dashboard setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/atlas-admin" element={<AtlasAdmin setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/vocab" element={<Vocab setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/atlas-index" element={<AtlasIndex setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/api" element={<Api setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                    <Route path="/map" element={<MapView setBreadcrumbs={(crumbs: Breadcrumb[]) => setBreadcrumbs(crumbs)}/>}/>
                </Routes>

            </main>
        </UserContext.Provider>
    );
}

