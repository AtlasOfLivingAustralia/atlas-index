/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * header for VITE_APP_SKIN=OZCAM
 */
function HeaderOzcam() {
    return (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
            <div className='hero-bg'></div>
            <div className='navbar navbar-inverse navbar-relative-top'>
                <div className='navbar-inner'>
                    <div className='container-fluid d-flex align-items-center'>
                        <a className='brand' href='https://ozcam.org.au/' title='OZCAM' rel='home'>
                            OZCAM
                        </a>
                        <ul id='main-menu' className='nav navbar-nav d-flex flex-row list-unstyled mb-0 ms-auto'>
                            <li id='menu-item-47' className='menu-item menu-item-type-post_type menu-item-object-page menu-item-47'>
                                <a href='https://ozcam.org.au/about/'>About</a>
                            </li>
                            <li id='menu-item-46' className='menu-item menu-item-type-post_type menu-item-object-page current-menu-item page_item page-item-41 current_page_item current-menu-ancestor current-menu-parent current_page_parent current_page_ancestor menu-item-46'>
                                <a href='https://ozcam.org.au/contributors/'>
                                    <span>Contributors</span>
                                </a>
                            </li>
                            <li id='menu-item-45' className='menu-item menu-item-type-post_type menu-item-object-page menu-item-45'>
                                <a href='https://ozcam.org.au/news/'>News</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <header className='jumbotron subhead' id='overview'>
                <div className='container-fluid'>
                    <h1>Search Specimens</h1>
                </div>
            </header>
        </div>
    );
}

export default HeaderOzcam;
