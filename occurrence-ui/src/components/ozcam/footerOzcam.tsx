/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import logoBanner from '../../image/ozcam/logo-banner.png';
import alaLogo from '../../image/ozcam/ALA-powered-by-logo-inline.png';

/**
 * header for VITE_APP_SKIN=OZCAM
 */
function FooterOzcam() {
    return (
        <>
            <footer className="wamfooter">
                <div className="${containerType}">
                    <div className="row">
                        <div className="span8">
                            <div id="text-7" className="widget widget_text">
                                <div className="textwidget">
                                    <p><a href="https://ozcam.org.au/contributors/">
                                        <img src={logoBanner} alt="Logos for the various partners of OZCAM" />
                                    </a></p>
                                    <p>OZCAM is an initiative of the <a href="https://chafc.org.au/">Council of Heads of Australian Faunal Collections (CHAFC)</a></p>
                                </div>
                            </div>
                        </div>
                        <div className="span4">
                            <a href="https://ala.org.au/">
                                <img className={"poweredByAlaLogo"} src={alaLogo} alt="Powered by Atlas of Living Australia" />
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

        </>
    );
}

export default FooterOzcam;
