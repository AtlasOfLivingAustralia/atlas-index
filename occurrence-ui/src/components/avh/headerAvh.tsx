/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FontAwesomeIconLite, useUser } from '@ala/common-ui';
import { faFacebookSquare } from '@fortawesome/free-brands-svg-icons';
import { faHome } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import avhLogo from '../../image/avh/avh-logo-white-80.png';

interface HeaderAvhProps {
    handleLoginFn?: () => void;
    handleLogoutFn?: () => void;
}

/**
 * header for VITE_APP_SKIN=AVH
 */
function HeaderAvh({ handleLoginFn, handleLogoutFn }: HeaderAvhProps) {
    const [navOpen, setNavOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const { userInfo } = useUser();

    const userdetailsBaseUrl = import.meta.env.VITE_USERDETAILS_URL;
    const displayName = [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(' ') || userInfo?.userId || '';

    return (
        <>
            <div id='avh-nav' className='navbar navbar-default'>
                <div className='container-fluid'>
                    <div className='navbar-inner'>
                        <div className='navbar-header d-flex d-md-none justify-content-end'>
                            <button type='button' className='navbar-toggler' onClick={() => setNavOpen(!navOpen)}>
                                <span className='icon-bar'></span>
                                <span className='icon-bar'></span>
                                <span className='icon-bar'></span>
                            </button>
                        </div>

                        <div className={`navbar-collapse${navOpen ? ' avh-nav-open' : ''}`}>
                            <ul className='nav navbar-nav'>
                                <li>
                                    <a href={import.meta.env.VITE_AVH_EXTERNAL_URL}>
                                        <FontAwesomeIconLite icon={faHome} />
                                    </a>
                                </li>
                                <li>
                                    <a href='/'>Search</a>
                                </li>
                                <li>
                                    <a href={import.meta.env.VITE_AVH_EXTERNAL_URL + '/about/'}>About {import.meta.env.VITE_SKIN}</a>
                                </li>
                                <li className={`dropdown font-xsmall${helpOpen ? ' show' : ''}`}>
                                    <a
                                        className='dropdown-toggle'
                                        role='button'
                                        aria-expanded={helpOpen}
                                        onClick={e => {
                                            e.preventDefault();
                                            setHelpOpen(prev => !prev);
                                        }}>
                                        Help<span className='caret'></span>
                                    </a>
                                    {helpOpen && (
                                        <ul className='dropdown-menu show avh-help-menu' role='menu'>
                                            <li>
                                                <a href={import.meta.env.VITE_AVH_EXTERNAL_URL + '/using-avh'}>Using {import.meta.env.VITE_SKIN}</a>
                                            </li>
                                            <li>
                                                <a href={import.meta.env.VITE_AVH_EXTERNAL_URL + '/data/'}>Data</a>
                                            </li>
                                            <li>
                                                <a href={'/fields'}>Download fields</a>
                                            </li>
                                        </ul>
                                    )}
                                </li>
                                <li>
                                    <a href={import.meta.env.VITE_AVH_EXTERNAL_URL + '/news'}>News</a>
                                </li>
                            </ul>
                            <ul className='nav navbar-nav ms-auto'>
                                <li>
                                    <a href='https://www.facebook.com/AustVirtHerb'>
                                        <FontAwesomeIconLite icon={faFacebookSquare} style={{ color: 'rgb(76, 153, 0)', height: '20px' }} />
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div id='site-branding' className='site-branding'>
                <div className='container-fluid'>
                    <div className='site-logo'>
                        <img src={avhLogo} alt='AVH logo' />
                    </div>
                    <div className='site-header'>
                        <h1 className='site-title'>
                            <a href={import.meta.env.VITE_AVH_EXTERNAL_URL} rel='home'>
                                {import.meta.env.VITE_SKIN}
                            </a>
                        </h1>
                        <h2 className='site-description'>{import.meta.env.VITE_HUB_NAME}</h2>
                    </div>
                    <div id='rightMenu'>
                        {userInfo?.authenticated ? (
                            <>
                                {displayName && (
                                    <a href={userdetailsBaseUrl ? `${userdetailsBaseUrl}/my-profile/` : '#'}>
                                        {displayName}
                                    </a>
                                )}
                                {displayName && <span style={{ margin: '0 4px' }}>|</span>}
                                <button className='btn btn-link' style={{ color: '#fff' }} onClick={handleLogoutFn}>Logout</button>
                            </>
                        ) : (
                            <button className='btn btn-link' style={{ color: '#fff' }} onClick={handleLoginFn}>Log In</button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default HeaderAvh;
