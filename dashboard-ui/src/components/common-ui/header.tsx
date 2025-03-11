import {useState, useEffect, useRef} from 'react';
import './common.css';
import {AutocompleteItem} from "../../api/sources/model.ts";
import FontAwesomeIcon from '../icon/fontAwesomeIconLite';
import {faSignIn} from '@fortawesome/free-solid-svg-icons/faSignIn';
import {faSignOut} from "@fortawesome/free-solid-svg-icons/faSignOut";

interface HeaderProps {
    isLoggedIn?: boolean
}

function Header({isLoggedIn}: HeaderProps) {

    const [openMenu, setOpenMenu] = useState(0);
    const [searchVisible, setSearchVisible] = useState(false);
    const [autocompleteResult, setAutocompleteResult] = useState<AutocompleteItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [autocompleteValue, setAutocompleteValue] = useState('');
    const [menuVisible, setMenuVisible] = useState(false);

    const menuRef = useRef<HTMLUListElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        function handleResize() {
            if (window.innerWidth > 1065) {
                changeMenuVisible(true);
            } else {
                changeMenuVisible(false);
                setMenuVisible(false);
            }
        }

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
                !(event.target && (event.target as HTMLElement).classList.contains("autocomplete-heading")) &&
                !(event.target && (event.target as HTMLElement).classList.contains("autocomplete-button"))) {
                setOpenMenu(0);
                setAutocompleteResult([])
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuRef]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (autocompleteResult.length > 0) {
                if (event.key === 'ArrowDown') {
                    setSelectedIndex((prevIndex) => (prevIndex + 1) % autocompleteResult.length);
                } else if (event.key === 'ArrowUp') {
                    setSelectedIndex((prevIndex) => (prevIndex - 1 + autocompleteResult.length) % autocompleteResult.length);
                } else if (event.key === 'Enter' && selectedIndex >= 0) {
                    openAutocompleteItem(autocompleteResult[selectedIndex].lsid);
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [autocompleteResult, selectedIndex]);

    useEffect(() => {
        debounceAutocomplete()
    }, [autocompleteValue]);

    function toggleMenu(menu: number) {
        setOpenMenu(menu === openMenu ? 0 : menu);
    }

    function debounceAutocomplete() {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            if (autocompleteValue && autocompleteValue.length > 2) {
                doAutocompleteSearch();
            } else {
                setSelectedIndex(-1);
                setAutocompleteResult([]);
            }
        }, 300);
    }

    function doAutocompleteSearch() {
        fetch(import.meta.env.VITE_NAMEMATCHING_WS + "/api/autocomplete?includeSynonyms=false&q=" + encodeURIComponent(autocompleteValue)).then(response => response.json()).then(json => {
            if (json) {
                setSelectedIndex(-1);
                setAutocompleteResult(json);
            }
        });
    }

    function openAutocompleteItem(lsid: string) {
        window.location.href = import.meta.env.VITE_SPECIES_URL_PREFIX + lsid;
    }

    function changeMenuVisible(visible: boolean) {
        // make the dom element with name "menu" visible or hidden
        var menu = document.getElementById("navbarOuterWrapper");
        if (menu) {
            menu.style.display = visible ? "block" : "none";
            setMenuVisible(visible);
        }
    }

    function logout() {
        // There is no central logout so only logout by deleting the auth cookie
        document.cookie = import.meta.env.VITE_AUTH_COOKIE + "; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        // reload page instead of updating isLoggedIn
        window.location.reload();
    }

    return (
        <header>
            <div id="wrapper-navbar" itemType="http://schema.org/WebSite">

                <nav className="navbar navbar-inverse navbar-expand-md">
                    <div className="container-fluid header-logo-menu">
                        {/*Your site title as branding in the menu*/}
                        <div className="navbar-header">
                            <div>
                                <a href={import.meta.env.VITE_HOME_URL} className="custom-logo-link navbar-brand"
                                   itemProp="url">
                                    <img width="1005" height="150"
                                         src={import.meta.env.VITE_LOGO_URL}
                                         className="custom-logo" alt="Atlas of Living Australia" itemProp="image"
                                         /> </a>
                                {/*end custom logo*/}
                            </div>
                        </div>

                        <div className="navbar-narrow">
                            <button
                                className="display-flex search-trigger hidden-md hidden-lg collapsed collapse-trigger-button"
                                title="Open search dialog" data-toggle="collapse"
                                data-target="#autocompleteSearchALA" onClick={() => setSearchVisible(!searchVisible)}>
                                {!searchVisible &&
                                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="18" viewBox="0 0 22 22">
                                        <path className="search-icon"
                                              d="M1524.33,60v1.151a7.183,7.183,0,1,1-2.69.523,7.213,7.213,0,0,1,2.69-.523V60m0,0a8.333,8.333,0,1,0,7.72,5.217A8.323,8.323,0,0,0,1524.33,60h0Zm6.25,13.772-0.82.813,7.25,7.254a0.583,0.583,0,0,0,.82,0,0.583,0.583,0,0,0,0-.812l-7.25-7.254h0Zm-0.69-7.684,0.01,0c0-.006-0.01-0.012-0.01-0.018s-0.01-.015-0.01-0.024a6,6,0,0,0-7.75-3.3l-0.03.009-0.02.006v0a0.6,0.6,0,0,0-.29.293,0.585,0.585,0,0,0,.31.756,0.566,0.566,0,0,0,.41.01V63.83a4.858,4.858,0,0,1,6.32,2.688l0.01,0a0.559,0.559,0,0,0,.29.29,0.57,0.57,0,0,0,.75-0.305A0.534,0.534,0,0,0,1529.89,66.089Z"
                                              transform="translate(-1516 -60)"></path>
                                    </svg>
                                }
                                {searchVisible &&
                                    <span aria-hidden="true" title="Close" className="collapseMenu">×</span>
                                }
                            </button>
                            {isLoggedIn &&
                                <a href={import.meta.env.VITE_OIDC_AUTH_PROFILE} role="button"
                                   className="account-mobile" title="Profile">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="18" viewBox="0 0 37 41">
                                        <path id="Account" className="account-icon"
                                              d="M614.5,107.1a11.549,11.549,0,1,0-11.459-11.549A11.516,11.516,0,0,0,614.5,107.1Zm0-21.288a9.739,9.739,0,1,1-9.664,9.739A9.711,9.711,0,0,1,614.5,85.81Zm9.621,23.452H604.874a8.927,8.927,0,0,0-8.881,8.949V125h37v-6.785A8.925,8.925,0,0,0,624.118,109.262Zm7.084,13.924H597.789v-4.975a7.12,7.12,0,0,1,7.085-7.139h19.244a7.119,7.119,0,0,1,7.084,7.139v4.975Z"
                                              transform="translate(-596 -84)"></path>
                                    </svg></a>
                            }
                            {isLoggedIn &&
                                <a href="/logout?" role="button"
                                   className="account-mobile hidden-md hidden-lg mobile-logout-btn"
                                   title="Logout"><FontAwesomeIcon icon={faSignOut}/></a>

                            }
                            {!isLoggedIn &&
                                <a href={import.meta.env.VITE_LOGIN_URL}
                                    role="button"
                                   className="account-mobile mobile-login-btn"
                                   title="Login button">
                                    <FontAwesomeIcon icon={faSignIn}/>
                                </a>
                            }
                            <button className="navbar-toggle collapsed collapse-trigger-button" type="button"
                                    onClick={() => changeMenuVisible(!menuVisible)}
                                    aria-controls="navbarOuterWrapper" aria-expanded="false"
                                    aria-label="Toggle navigation">
                                { !menuVisible && <>
                                    <div className="horizontal-line"></div>
                                    <div className="horizontal-line"></div>
                                    <div className="horizontal-line"></div>
                                </>}
                                { menuVisible &&
                                    <span className="collapseMenu" aria-hidden="true">×</span>
                                }
                            </button>
                        </div>

                        <div id="navbarOuterWrapper" className="outer-nav-wrapper">
                            <div className="top-bar hidden-xs hidden-sm navbar-wide">
                                <a href={import.meta.env.VITE_CONTACT_URL} className="btn btn-link btn-sm">Contact
                                    us</a>
                                {isLoggedIn &&
                                    <div className="account signedIn">
                                        <a href={import.meta.env.VITE_OIDC_AUTH_PROFILE}
                                           className="btn btn-outline-white btn-sm myProfileBtn mr-loginbtns"
                                           role="button">Profile</a>
                                        <a onClick={() => logout()} className="btn btn-outline-white btn-sm logoutBtn"
                                           role="button">Logout</a>
                                    </div>
                                }
                                {!isLoggedIn &&
                                    <div className="account signedIn">
                                        <a href={import.meta.env.VITE_CREATE_ACCOUNT_URL}
                                           className="btn btn-outline-white btn-sm mr-loginbtns" role="button">Sign
                                            up</a>
                                        <a href={import.meta.env.VITE_LOGIN_URL}
                                           className="btn btn-primary btn-sm btnLogin ">Login</a>
                                    </div>
                                }
                            </div>
                            <div className="main-nav-wrapper">
                                {/*The WordPress Menu goes here*/}
                                <div id="navbarNavDropdown">
                                    <ul id="main-menu" className="nav navbar-nav" role="menubar" ref={menuRef}>
                                        <li
                                            itemType="https://www.schema.org/SiteNavigationElement"
                                            className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children dropdown nav-item show">
                                            <a onClick={() => toggleMenu(1)} aria-haspopup="true" aria-expanded="true"
                                               className="dropdown-toggle nav-link" id="menu-item-dropdown-22">Search
                                                &amp; analyse <span className="caret"></span></a>
                                            {openMenu == 1 &&
                                                <ul className="dropdown-menu show"
                                                    aria-labelledby="menu-item-dropdown-22" role="menu">
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-41958"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41958 nav-item">
                                                        <a href="https://bie.ala.org.au/" className="dropdown-item">Search
                                                            species</a></li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-23"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-23 nav-item">
                                                        <a href="https://biocache.ala.org.au/search#tab_simpleSearch"
                                                           className="dropdown-item">Search &amp; download records</a>
                                                    </li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-28"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-28 nav-item">
                                                        <a href="https://collections.ala.org.au/datasets"
                                                           className="dropdown-item">Search datasets</a></li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-41967" role="separator" className="divider"></li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-24"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-24 nav-item">
                                                        <a href="https://spatial.ala.org.au/" className="dropdown-item">Spatial
                                                            analysis (Spatial Portal)</a></li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-26"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-26 nav-item">
                                                        <a href="https://biocache.ala.org.au/explore/your-area"
                                                           className="dropdown-item">Explore
                                                            your area</a></li>
                                                    <li
                                                        itemType="https://www.schema.org/SiteNavigationElement"
                                                        id="menu-item-31"
                                                        className="menu-item menu-item-type-custom menu-item-object-custom menu-item-31 nav-item">
                                                        <a href="https://collections.ala.org.au/"
                                                           className="dropdown-item">Explore
                                                            natural
                                                            history collections</a></li>
                                                </ul>
                                            }
                                        </li>
                                        <li
                                            itemType="https://www.schema.org/SiteNavigationElement" id="menu-item-32"
                                            className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children dropdown menu-item-32 nav-item">
                                            <a onClick={() => toggleMenu(2)} aria-haspopup="true"
                                               aria-expanded="false" className="dropdown-toggle nav-link"
                                               id="menu-item-dropdown-32">Contribute&nbsp;
                                                <span className="caret"></span></a>
                                            {openMenu == 2 && <ul className="dropdown-menu show"
                                                                  aria-labelledby="menu-item-dropdown-32"
                                                                  role="menu">
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40773"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-40773 nav-item">
                                                    <a href="https://support.ala.org.au/support/solutions/articles/6000261427-sharing-a-dataset-with-the-ala"
                                                       className="dropdown-item">Share your dataset</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40728"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-40728 nav-item">
                                                    <a href="https://lists.ala.org.au/public/speciesLists"
                                                       className="dropdown-item">Upload
                                                        species list</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41968" role="separator" className="divider"></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-33"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-33 nav-item">
                                                    <a href="https://www.ala.org.au/home/record-a-sighting/"
                                                       className="dropdown-item">Record a sighting</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-35"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-35 nav-item">
                                                    <a href="https://volunteer.ala.org.au/"
                                                       className="dropdown-item">Transcribe &amp;
                                                        digitise (DigiVol)</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-37"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-37 nav-item">
                                                    <a href="https://biocollect.ala.org.au/acsa"
                                                       className="dropdown-item">Discover citizen science projects</a>
                                                </li>
                                            </ul>
                                            }
                                        </li>
                                        <li
                                            itemType="https://www.schema.org/SiteNavigationElement"
                                            className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown nav-item">
                                            <a onClick={() => toggleMenu(3)} aria-haspopup="true"
                                               aria-expanded="false"
                                               className="dropdown-toggle nav-link">Resources&nbsp;
                                                <span className="caret"></span></a>
                                            {openMenu == 3 && <ul className="dropdown-menu show"
                                                                  aria-labelledby="menu-item-dropdown-199"
                                                                  role="menu">
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page nav-item">
                                                    <a href="https://www.ala.org.au/publications/"
                                                       className="dropdown-item">Brochures and reports</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page nav-item">
                                                    <a href="https://www.ala.org.au/ala-logo-and-identity/"
                                                       className="dropdown-item">ALA logo and identity</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page nav-item">
                                                    <a href="https://www.ala.org.au/ala-cited-publications/"
                                                       className="dropdown-item">ALA-cited publications</a></li>
                                                <li className="menu-item menu-item-type-post_type menu-item-object-page nav-item">
                                                    <a href="https://www.ala.org.au/abdmp/" className="dropdown-item">Data
                                                        Mobilisation Program</a></li>
                                                <li className="menu-item menu-item-type-post_type menu-item-object-page nav-item">
                                                    <a href="https://labs.ala.org.au/" className="dropdown-item">ALA
                                                        Labs</a></li>
                                            </ul>
                                            }
                                        </li>

                                        <li
                                            itemType="https://www.schema.org/SiteNavigationElement" id="menu-item-178"
                                            className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children dropdown menu-item-178 nav-item">
                                            <a onClick={() => toggleMenu(4)} aria-haspopup="true"
                                               aria-expanded="false" className="dropdown-toggle nav-link"
                                               id="menu-item-dropdown-178">About&nbsp;
                                                <span className="caret"></span></a>
                                            {openMenu == 4 && <ul className="dropdown-menu show"
                                                                  aria-labelledby="menu-item-dropdown-178"
                                                                  role="menu">
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-179"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page menu-item-179 nav-item">
                                                    <a href="https://www.ala.org.au/about-ala/"
                                                       className="dropdown-item">About us</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40734"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page current_page_parent menu-item-40734 nav-item">
                                                    <a href="https://www.ala.org.au/governance"
                                                       className="dropdown-item">Governance</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40734"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page current_page_parent menu-item-40734 nav-item">
                                                    <a href="https://www.ala.org.au/blog/"
                                                       className="dropdown-item">News &amp; media</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40734"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page current_page_parent menu-item-40734 nav-item">
                                                    <a href="https://www.ala.org.au/careers/"
                                                       className="dropdown-item">Careers</a></li>
                                                <li className="menu-item menu-item-type-post_type menu-item-object-page current_page_parent nav-item">
                                                    <a href="https://www.ala.org.au/internships/"
                                                       className="dropdown-item">Internships</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-175"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page menu-item-175 nav-item">
                                                    <a href="https://www.ala.org.au/contact-us/"
                                                       className="dropdown-item">Contact us</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41969" role="separator" className="divider"></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page  nav-item">
                                                    <a href="https://www.ala.org.au/current-projects/"
                                                       className="dropdown-item">Current projects</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-40799"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-40731 nav-item">
                                                    <a href="https://living-atlases.gbif.org/"
                                                       className="dropdown-item">International Living Atlases</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-177"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page menu-item-177 nav-item">
                                                    <a href="https://www.ala.org.au/indigenous-ecological-knowledge/"
                                                       className="dropdown-item">Indigenous ecological knowledge</a>
                                                </li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41970" role="separator" className="divider"></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41796"
                                                    className="menu-item menu-item-type-post_type menu-item-object-page menu-item-41796 nav-item">
                                                    <a href="https://www.ala.org.au/sites-and-services/"
                                                       className="dropdown-item">All
                                                        sites, services &amp; tools</a></li>
                                            </ul>
                                            }
                                        </li>
                                        <li
                                            itemType="https://www.schema.org/SiteNavigationElement" id="menu-item-41391"
                                            className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children dropdown menu-item-41391 nav-item">
                                            <a onClick={() => toggleMenu(5)} aria-haspopup="true"
                                               aria-expanded="false" className="dropdown-toggle nav-link"
                                               id="menu-item-dropdown-41391">Help&nbsp;
                                                <span className="caret"></span></a>
                                            {openMenu == 5 && <ul className="dropdown-menu show"
                                                                  aria-labelledby="menu-item-dropdown-41391"
                                                                  role="menu">
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41959"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41959 nav-item">
                                                    <a href="https://support.ala.org.au/support/home"
                                                       className="dropdown-item">Browse
                                                        all articles (FAQs)</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41960"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41960 nav-item">
                                                    <a href="https://support.ala.org.au/support/solutions/6000137994"
                                                       className="dropdown-item">ALA Data help</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41961"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41961 nav-item">
                                                    <a href="https://support.ala.org.au/support/solutions/6000138053"
                                                       className="dropdown-item">ALA Tools &amp; Apps help</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41962"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41962 nav-item">
                                                    <a href="https://support.ala.org.au/support/solutions/6000138349"
                                                       className="dropdown-item">ALA Spatial Portal help</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom nav-item">
                                                    <a href="https://support.ala.org.au/support/solutions/articles/6000261662-citing-the-ala"
                                                       className="dropdown-item">How to cite the ALA</a></li>
                                                <li
                                                    itemType="https://www.schema.org/SiteNavigationElement"
                                                    id="menu-item-41963"
                                                    className="menu-item menu-item-type-custom menu-item-object-custom menu-item-41963 nav-item">
                                                    <a href="https://www.ala.org.au/contact-us/"
                                                       className="dropdown-item">Contact us</a>
                                                </li>
                                            </ul>
                                            }
                                        </li>
                                    </ul>
                                </div>
                                <button className="search-trigger hidden-xs hidden-sm collapsed collapse-trigger-button"
                                        data-toggle="collapse" data-target="#autocompleteSearchALA"
                                        onClick={() => setSearchVisible(!searchVisible)}
                                        title="Open search control">
                                    {!searchVisible && <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"
                                                            viewBox="0 0 22 22">
                                        <path className="search-icon"
                                              d="M1524.33,60v1.151a7.183,7.183,0,1,1-2.69.523,7.213,7.213,0,0,1,2.69-.523V60m0,0a8.333,8.333,0,1,0,7.72,5.217A8.323,8.323,0,0,0,1524.33,60h0Zm6.25,13.772-0.82.813,7.25,7.254a0.583,0.583,0,0,0,.82,0,0.583,0.583,0,0,0,0-.812l-7.25-7.254h0Zm-0.69-7.684,0.01,0c0-.006-0.01-0.012-0.01-0.018s-0.01-.015-0.01-0.024a6,6,0,0,0-7.75-3.3l-0.03.009-0.02.006v0a0.6,0.6,0,0,0-.29.293,0.585,0.585,0,0,0,.31.756,0.566,0.566,0,0,0,.41.01V63.83a4.858,4.858,0,0,1,6.32,2.688l0.01,0a0.559,0.559,0,0,0,.29.29,0.57,0.57,0,0,0,.75-0.305A0.534,0.534,0,0,0,1529.89,66.089Z"
                                              transform="translate(-1516 -60)"></path>
                                    </svg>}
                                    {searchVisible &&
                                        <span aria-hidden="true" title="Close" className="visible-on-show">×</span>
                                    }
                                </button>
                            </div>

                        </div>
                    </div>
                    {/*.container */}
                    {searchVisible && <div className="container-fluid">
                        <div id="autocompleteSearchALA">
                            <div className="space-between">
                                <input id="autocompleteHeader" type="text" name="q"
                                       placeholder="Search species, datasets, and more..."
                                       className="search-input ui-autocomplete-input" autoComplete="off"
                                       value={autocompleteValue}
                                       onChange={(event) => setAutocompleteValue(event.target.value)}/>
                                <button className="search-submit" onClick={() => doAutocompleteSearch()}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"
                                         className={"autocomplete-button"}
                                         viewBox="0 0 22 22">
                                        <path className="search-icon"
                                              d="M1524.33,60v1.151a7.183,7.183,0,1,1-2.69.523,7.213,7.213,0,0,1,2.69-.523V60m0,0a8.333,8.333,0,1,0,7.72,5.217A8.323,8.323,0,0,0,1524.33,60h0Zm6.25,13.772-0.82.813,7.25,7.254a0.583,0.583,0,0,0,.82,0,0.583,0.583,0,0,0,0-.812l-7.25-7.254h0Zm-0.69-7.684,0.01,0c0-.006-0.01-0.012-0.01-0.018s-0.01-.015-0.01-0.024a6,6,0,0,0-7.75-3.3l-0.03.009-0.02.006v0a0.6,0.6,0,0,0-.29.293,0.585,0.585,0,0,0,.31.756,0.566,0.566,0,0,0,.41.01V63.83a4.858,4.858,0,0,1,6.32,2.688l0.01,0a0.559,0.559,0,0,0,.29.29,0.57,0.57,0,0,0,.75-0.305A0.534,0.534,0,0,0,1529.89,66.089Z"
                                              transform="translate(-1516 -60)"></path>
                                    </svg>
                                </button>
                            </div>
                            {autocompleteResult && autocompleteResult.length > 0 && <ul id="ui-id-1"
                                                                                        className="ui-menu ui-widget ui-widget-content ui-autocomplete ui-front autocomplete-dropdown">
                                {autocompleteResult.map((item, index) => (
                                    <li key={index}
                                        className={"autocomplete-item striped ui-menu-item " + (index === selectedIndex ? 'ui-state-focus' : '')}
                                        onClick={() => openAutocompleteItem(item.lsid)}
                                        onMouseOver={() => setSelectedIndex(index)}>
                                        <div className="content-spacing">
                                            <div className="autocomplete-heading">{item.name}</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            }
                        </div>
                    </div>
                    }
                </nav>
                {/*.site-navigation*/}

            </div>


        </header>
    );
};

export default Header;
