/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import alaLogo from '../../image/ozcam/ALA-powered-by-logo-inline.png';

/**
 * header for VITE_APP_SKIN=AVH
 */
function FooterAvh() {
    return (
        <footer id='colophon' className='site-footer' role='contentinfo'>
            <div className='container-fluid'>
                <div className='row'>
                    <aside id='text-3' className='widget col-sm-6  clearfix widget_text powered-by'>
                        <div className='textwidget'>
                            <a href='https://ala.org.au/'>
                                <img className={'poweredByAlaLogo'} src={alaLogo} alt='Powered by Atlas of Living Australia' />
                            </a>
                        </div>
                    </aside>
                    <aside id='text-2' className='widget col-sm-6  clearfix widget_text contact-us'>
                        <div className='textwidget'>
                            <a href={import.meta.env.VITE_AVH_EXTERNAL_URL + '/contact-us'}>Contact us</a>
                        </div>
                    </aside>
                </div>
            </div>
        </footer>
    );
}

export default FooterAvh;
