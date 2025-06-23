/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from 'react';
import {AutocompleteItem} from "../../api/sources/model.ts";
import {
    setClickEventByClassName,
    setClickEventById,
    setElementDisplayByClassName,
    setElementDisplayById,
    showLoginLogoutButtons
} from './utils.tsx';

interface HeaderProps {
    isLoggedIn?: boolean,
    loginFn?: () => void,
    logoutFn?: () => void
}

/**
 * Depends highly on what is in the external header html. This component is responsible for setting up the header.
 *
 * Header must not contain script tags, as they will not be executed.
 *
 * Header HTML functionality supported is:
 *   1. <input id="autocompleteHeader"> is used for autocomplete search
 *     a. Items are displayed in a ul inserted by this component below the autocompleteSearchALA div
 *     b. Manual search is triggered by clicking the element with class="autocomplete-search-button"
 *   2. class="header-menu-button"> - a mobile only menu (closed by default)
 *     a. class="collapse-menu-false" is visible (display:block) when closed
 *     b. class="collapse-menu-true" is visible (display:inline-block) when open
 *     c. class="navbarOuterWrapper" is visible (display:block) when open
 *   3. class="header-search-button" - toggle for the visibility of the autocomplete (closed by default)
 *    a. class="search-visible-true" is visible (display:inline-block) when open
 *    b. class="search-visible-false" is visible (display:none) when closed
 *   4. class="header-open-menu-*" - * is 1 to n for menu items that can be opened (default closed, only one can be open)
 *    a. class="header-open-menu-item-*" - * is 1 to n for each menu content that can be toggled open/closed (display:block/none)
 *   5. class="header-login-button" - button that triggers the login function
 *   6. class="header-logout-button" - button that triggers the logout function
 *   7. class="signedIn" - section that is visible when logged in (same as footer.tsx)
 *   8. class="signedOut" - section that is visible when logged out (same as footer.tsx)
 *
 * Refer to /static-server/static/common-header.html for an example of the header html
 *
 * @param isLoggedIn
 * @param loginFn
 * @param logoutFn
 * @constructor
 */
function Header({isLoggedIn, loginFn, logoutFn}: HeaderProps) {

    const [openMenu, setOpenMenu] = useState(0);
    const [searchVisible, setSearchVisible] = useState(false);
    const [autocompleteResult, setAutocompleteResult] = useState<AutocompleteItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [autocompleteValue, setAutocompleteValue] = useState('');
    const [menuVisible, setMenuVisible] = useState<boolean | undefined>(undefined);
    const [mobileWidth, setMobileWidth] = useState(10);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    const [externalHeaderHtml, setExternalHeaderHtml] = useState('');

    // fetch the external header html
    useEffect(() => {
        fetch(import.meta.env.VITE_COMMON_HEADER_HTML)
            .then((response) => response.text())
            .then((text) => setExternalHeaderHtml(text));
    }, []);

    // setup the html after the component is mounted
    useEffect(() => {
        if (externalHeaderHtml && externalHeaderHtml.length > 0) {
            setupHtml();
        }
    }, [externalHeaderHtml]);

    // listen for login status changes
    useEffect(() => {
        showLoginLogoutButtons(isLoggedIn);
    }, [isLoggedIn]);

    // Integrate the dynamic html. It involves showing/hiding, setting up listeners, fetching some constants
    function setupHtml() {
        // loop until <header> is available
        const header = document.getElementsByTagName("header");
        if (header.length == 0) {
            setTimeout(() => {
                setupHtml();
            }, 10);
            return;
        }

        // this is set in the header html and is aligned with the css
        var mWidth = parseInt((document.getElementById("mobileMaxWidth") as HTMLInputElement).value, 10);
        setMobileWidth(mWidth);

        // show/hide elements, set up listeners
        showLoginLogoutButtons(isLoggedIn); // might be unset, this is fine
        addAutocompleteList();
        applySearchVisible();
        addListeners();

        if (window.innerWidth > mWidth) {
            setMenuVisible(true);
        } else {
            setMenuVisible(false);
        }
    }

    // Adds listeners to the header elements for the interactive elements
    // 1. <input id="autocompleteHeader"> - listens for changes typed into the autocomplete
    //   a. Items are displayed in a ul inserted below the autocompleteSearchALA div
    //   b. Manual search is triggered by clicking the element with class="autocomplete-search-button"
    // 2. class="autocomplete-search-button" - Button that triggers an autocomplete search
    // 3. class="header-menu-button"> - listens for click events to toggle a mobile only menu (closed by default)
    //   a. class="collapse-menu-false" is visible (display:block) when closed
    //   b. class="collapse-menu-true" is visible (display:inline-block) when open
    //   c. class="navbarOuterWrapper" is visible (display:block) when open
    // 4. class="header-search-button" - listens for click events to toggle the search bar
    //  a. class="search-visible-true" is visible (display:inline-block) when open
    //  b. class="search-visible-false" is visible (display:none) when closed
    // 5. class="header-open-menu-*" - * is 1 to n for each menu that can be toggled open/closed (also closing other menus when opened)
    //  a. class="header-open-menu-item-*" - * is 1 to n for each menu content that can be toggled open/closed
    // 6. class="header-login-button" and class="header-logout-button" - listens for click events to trigger the login function
    //
    // Unmount is not required because the header/footer (and the referenced elements) are only present when the
    // component is mounted.
    function addListeners() {
        // 1. Autocomplete input
        const item = document.getElementById("autocompleteHeader");
        if (item) {
            item.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                if (target) {
                    setAutocompleteValue(target.value);
                }
            });
        }

        // 2. Autocomplete search button
        setClickEventByClassName("autocomplete-search-button", doAutocompleteSearch);

        // 3. Mobile only menu toggle
        setClickEventByClassName("header-menu-button", () =>
            setMenuVisible((prevMenuVisible) => !prevMenuVisible)
        );

        // 4. Autcomplete visibility toggle
        setClickEventByClassName("header-search-button", () => setSearchVisible((prevSearchVisible) => !prevSearchVisible));

        // 5. Menu toggles
        const dropDownMenus = document.getElementsByClassName("dropdown-menu")
        for (let i = 1; i <= dropDownMenus.length; i++) {
            setClickEventById("header-open-menu-" + i, () => toggleMenu(i));
        }

        // 6. Login buttons
        setClickEventByClassName("header-login-button", loginFn);

        // 6. logout buttons
        setClickEventByClassName("header-logout-button", logoutFn);
    }

    // There is an autocomplete dropdown below the autocompleteSearchALA div. This function adds a list below the
    // div. It is used to contain the autocomplete items.
    function addAutocompleteList() {
        const autocompleteListParent = document.getElementById("autocompleteSearchALA");
        if (autocompleteListParent) {
            const list = document.createElement('ul');
            list.id = "header-autocomplete-list";
            list.className = "ui-menu ui-widget ui-widget-content ui-autocomplete ui-front autocomplete-dropdown no-border";

            autocompleteListParent.appendChild(list);
        }
    }

    // this function updates the autocomplete list with the current autocompleteResult
    useEffect(() => {
        const autocompleteList = document.getElementById("header-autocomplete-list");

        if (autocompleteList) {
            autocompleteList.innerHTML = ""

            const listItems = autocompleteResult.map((item, index) => {
                const li = document.createElement('li');
                li.className = 'autocomplete-item autocomplete-item-' + index;
                li.onclick = () => openAutocompleteItem(item.lsid);
                li.onmouseover = () => setSelectedIndex(index);
                li.innerHTML = item.name + "***";
                return li;
            });

            listItems.forEach(item => autocompleteList.appendChild(item));

            if (listItems.length == 0) {
                autocompleteList.classList.add('no-border');
            } else {
                autocompleteList.classList.remove('no-border');
            }
        }
    }, [autocompleteResult]);

    // this function updates the highlight applied to the selected item in the autocomplete list
    useEffect(() => {
        const items = document.getElementsByClassName('autocomplete-item-selected');
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('autocomplete-item-selected');
        }
        const selected = document.getElementsByClassName('autocomplete-item-' + selectedIndex);
        if (selected.length > 0) {
            selected[0].classList.add('autocomplete-item-selected');
        }

    }, [selectedIndex]);

    // resets the autocomplete debouncer when the component is unmounted
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    // perform window resize events
    function handleResize() {
        if (window.innerWidth > mobileWidth) {
            setMenuVisible(true);
        } else {
            setMenuVisible(false);
        }
    }

    // this effect listens for window resize events to determine if the menu should be visible or not, while mounted
    useEffect(() => {
        window.removeEventListener('resize', handleResize);

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [mobileWidth]);

    // this effect listens for clicks outside the menu to close the menu and autocomplete dropdown, while mounted
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const menuElement = document.getElementById("main-menu");
            if (menuElement && !menuElement.contains(event.target as Node) &&
                !(event.target && (event.target as HTMLElement).classList.contains("autocomplete-heading")) &&
                !(event.target && (event.target as HTMLElement).classList.contains("autocomplete-button")) &&
                !(event.target && (event.target as HTMLElement).classList.contains("autocomplete-item"))) {
                setOpenMenu(0);
                setAutocompleteResult([])
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // this effect listens for keyboard events to navigate the autocomplete dropdown, while mounted
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
                event.preventDefault();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [autocompleteResult, selectedIndex]);

    // for debouncing autocomplete
    useEffect(() => {
        debounceAutocomplete()
    }, [autocompleteValue]);

    // for debouncing autocomplete
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

    // perform autocomplete fetch
    function doAutocompleteSearch() {
        // use document.getElementById("autocompleteHeader").value as a workaround for one use case
        const inputElement = document.getElementById("autocompleteHeader") as HTMLInputElement;
        const searchTerm = inputElement.value
        fetch(import.meta.env.VITE_NAMEMATCHING_WS + "/api/autocomplete?includeSynonyms=false&q=" + encodeURIComponent(searchTerm)).then(response => response.json()).then(json => {
            if (json) {
                setSelectedIndex(-1);
                setAutocompleteResult(json);
            }
        });
    }

    // toggles the mobile only menu open/closed
    function toggleMenu(menu: number) {
        setOpenMenu((prevOpenMenu) => (menu === prevOpenMenu ? 0 : menu));
    }

    // opens the species page for the selected autocomplete
    function openAutocompleteItem(lsid: string) {
        window.location.href = import.meta.env.VITE_SPECIES_URL_PREFIX + lsid;
    }

    // displays only the menu that is open when the openMenu state changes
    useEffect(() => {
        const dropDownMenus = document.getElementsByClassName("dropdown-menu")
        for (let i = 1; i <= dropDownMenus.length; i++) {
            setElementDisplayById("header-open-menu-item-" + i, openMenu == i ? "block" : "none");
        }
    }, [openMenu]);

    // reset the autocomplete when its visiblity changes
    useEffect(() => {
        setAutocompleteResult([]);
        applySearchVisible();
    }, [searchVisible]);

    // apply the current search visibility to the elements with the search-visible-true/false classes
    function applySearchVisible() {
        setElementDisplayByClassName("search-visible-true", !searchVisible ? "none" : "inline-block");
        setElementDisplayByClassName("search-visible-false", searchVisible ? "none" : "inline-block");
    }

    // apply the changed mobile only menu visibility to the elements with the collapse-menu-true/false classes
    useEffect(() => {
        setElementDisplayByClassName("collapse-menu-false", menuVisible ? "none" : "block");
        setElementDisplayByClassName("collapse-menu-true", !menuVisible ? "none" : "inline-block");
        setElementDisplayById("navbarOuterWrapper", menuVisible ? "block" : "none");
    }, [menuVisible]);

    return <>
        {externalHeaderHtml &&
            <div dangerouslySetInnerHTML={{__html: externalHeaderHtml}}></div>
        }
    </>
};

export default Header;
