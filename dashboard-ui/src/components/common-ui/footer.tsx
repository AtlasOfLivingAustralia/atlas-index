import "./common.css";
// import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import FontAwesomeIcon from '../icon/fontAwesomeIconLite'
import {faFacebookF} from '@fortawesome/free-brands-svg-icons/faFacebookF'
import {faTwitter} from '@fortawesome/free-brands-svg-icons/faTwitter'

interface FooterProps {
    isLoggedIn?: boolean
}

function Footer({isLoggedIn}: FooterProps) {

    return (
        <footer className="site-footer bootstrap" id="colophon">
            <div className="footer-top">
                <div className="container">
                    <div className="row align-items-center align-items-stretch">
                        <div className="col-sm-12 col-md-12 col-lg-4 align-center logo-column">
                            <img width="1005" src="https://www.ala.org.au/app/uploads/2019/01/logo.png"
                                 className="custom-logo" alt="Atlas of Living Australia" itemProp="logo"
                                 srcSet="https://www.ala.org.au/app/uploads/2019/01/logo.png 1005w, https://www.ala.org.au/app/uploads/2019/01/logo-300x45.png 300w, https://www.ala.org.au/app/uploads/2019/01/logo-768x115.png 768w"
                                 sizes="(max-width: 1005px) 100vw, 1005px"/>
                            <div className="account signedIn">
                                {!isLoggedIn && <a href="https://aws-auth-test-2023.test.ala.org.au/userdetails/registration/createAccount"
                                   className="btn btn-outline-white btn-sm mr-loginbtns-footer" role="button">Sign up</a>
                                }
                                {isLoggedIn && <a href="https://aws-auth-test-2023.test.ala.org.au/userdetails/myprofile/"
                                   className="btn btn-outline-white btn-sm myProfileBtn mr-loginbtns-footer"
                                   role="button">My profile</a>}
                                {!isLoggedIn &&
                                    <a href="/login?path=https%3A%2F%2Fdashboard-test.ala.org.au%2F"
                                       className="btn btn-primary btn-sm btnLogin mr-loginbtns-footer">Login</a>
                                }
                                {isLoggedIn && <a href="/logout?"
                                   className="btn btn-outline-white btn-sm logoutBtn mr-loginbtns-footer"
                                   role="button">Logout</a>
                                }
                                <ul className="social">
                                    <li><a href="http://www.facebook.com/atlasoflivingaustralia" target="_blank">
                                        <FontAwesomeIcon icon={faFacebookF}/></a></li>
                                    <li><a href="http://www.twitter.com/atlaslivingaust" target="_blank">
                                        <FontAwesomeIcon icon={faTwitter}/>
                                    </a></li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-sm-6 col-md-6 col-lg-4 content-column">
                            <div className="media content">
                                <div className="media-left">
                                    <img className="media-object image"
                                         src="https://www.ala.org.au/app/uploads/2020/04/iNaturalistAU-Logomark-white.svg"
                                         alt=""/>
                                </div>
                                <div className="media-body">
                                    <h4 className="h4"><a className="underline"
                                                          href="https://www.ala.org.au/home/record-a-sighting/">Record
                                        a Sighting</a></h4>
                                    <p>Upload your observations, identify species, and contribute to the ALA.</p>
                                </div>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-sm-6 col-md-6 col-lg-4 content-column">
                            <div className="media content">
                                <div className="media-left">
                                    <img className="media-object image"
                                         src="https://www.ala.org.au/app/uploads/2019/05/spatial-portal-white-trans-70.png"
                                         alt=""/>
                                </div>
                                <div className="media-body">
                                    <h4 className="h4"><a href="https://spatial.ala.org.au/" className="underline">Explore
                                        the
                                        Spatial Portal</a></h4>
                                    <p>Visualise and analyse relationships between species, location and
                                        environment.</p>
                                </div>
                            </div>
                        </div>
                        {/*col end*/}
                    </div>
                    {/*row end*/}
                </div>
                {/*container end*/}
            </div>

            <div className="footer-middle">
                <div className="container">
                    <div className="row">
                        <div className="col-md-6 col-lg-3 padding-lr-15">

                            <div className="footer-menu">
                                <ul id="menu-search-analyse" className="menu">
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children">
                                        <a href="#">Search &amp; analyse</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://bie.ala.org.au/">Search species</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://biocache.ala.org.au/search#tab_simpleSearch">Search &amp;
                                                download records</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://collections.ala.org.au/datasets">Search
                                                datasets</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://spatial.ala.org.au/">Spatial analysis (Spatial Portal)</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://biocache.ala.org.au/explore/your-area">Explore your
                                                area</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://collections.ala.org.au/">Explore natural history
                                                collections</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://regions.ala.org.au/">Explore
                                                regions</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://lists.ala.org.au/iconic-species">Browse
                                                Australian iconic species</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://specimens.ala.org.au/">Browse
                                                specimen images</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-md-6 col-lg-3 padding-lr-15">

                            <div className="footer-menu">
                                <ul id="menu-contribute" className="menu">
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children">
                                        <a href="#">Contribute</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://support.ala.org.au/support/solutions/articles/6000195493-how-to-submit-a-data-set">Share
                                                your dataset</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://lists.ala.org.au/public/speciesLists">Upload species
                                                list</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/home/record-a-sighting/">Record
                                                a sighting</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                title="Transcribe &amp; digitise (DigiVol)"
                                                href="https://digivol.ala.org.au/">Transcribe &amp; digitise
                                                (DigiVol)</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://biocollect.ala.org.au/acsa">Discover
                                                citizen science projects</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/who-we-are-3/downloadable-tools/ala-mobile-app/">Download
                                                mobile apps</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-md-6 col-lg-3 padding-lr-15">
                            <div className="footer-menu">
                                <ul id="menu-resources" className="menu">
                                    <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children">
                                        <a href="#">Resources</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/publications/">Brochures and reports
                                            </a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/ala-logo-and-identity/">ALA logo and
                                                identity
                                            </a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/ala-cited-publications/">ALA-cited
                                                publications
                                            </a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/education-resources/">Education
                                                resources</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/abdmp/">Data Mobilisation Program</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://labs.ala.org.au/">ALA Labs</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/* col end */}
                        <div className="col-md-6 col-lg-3 padding-lr-15">
                            <div className="footer-menu">
                                <ul id="menu-about" className="menu">
                                    <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children">
                                        <a href="https://www.ala.org.au/about-ala/">About</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/about-ala/">About us</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/governance">Governance</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/blog/">News &amp; media</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/careers/">Careers</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/contact-us/">Contact
                                                us</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/current-projects/">Current projects</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://living-atlases.gbif.org/">International Living Atlases</a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/indigenous-ecological-knowledge/">Indigenous
                                                ecological knowledge</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/sites-and-services/">All
                                                sites, services &amp; tools</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                    </div>
                    {/*row end*/}
                    <div className="row">
                        <div className="col-md-6 col-lg-3 padding-lr-15">
                            <div className="footer-menu">
                                <ul id="menu-tools" className="menu">
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children">
                                        <a href="#">Tools</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/biocollect/">BioCollect</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://galah.ala.org.au/">galah</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://zoatrack.org/">Zoatrack</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://profiles.ala.org.au/opus/foa">Flora of Australia</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://fieldcapture.ala.org.au/">MERIT</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://dashboard.ala.org.au/">ALA dashboard</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/sites-and-services/">All sites, service and
                                                tools</a>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-md-6 col-lg-3 padding-lr-15">

                            <div className="footer-menu">
                                <ul id="menu-community-hubs" className="menu">
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children">
                                        <a href="#">Community hubs</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://avh.ala.org.au/">AVH:
                                                Australasian Virtual Herbarium</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://ozcam.ala.org.au/">OZCAM: Online Zoological
                                                Collections</a>
                                            </li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://asbp.ala.org.au/">ASBP: Australian Seed Bank
                                                Partnership</a>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-md-6 col-lg-3 padding-lr-15">

                            <div className="footer-menu">
                                <ul id="menu-ala-for" className="menu">
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children">
                                        <a href="#">ALA for...</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/ala-for-researchers">ALA for
                                                researchers</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/ala-for-government-and-land-managers-2/">ALA
                                                for government
                                                and land
                                                managers</a></li>
                                            <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                                href="https://www.ala.org.au/ala-for-community-and-schools-2/">ALA for
                                                community and
                                                schools</a>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                        <div className="col-md-6 col-lg-3 padding-lr-15">
                            <div className="footer-menu">
                                <ul id="menu-about" className="menu">
                                    <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children">
                                        <a href="#">Help</a>
                                        <ul className="sub-menu">
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://support.ala.org.au/support/home">Browse all articles
                                                (FAQs)
                                            </a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://support.ala.org.au/support/solutions/6000137994">ALA Data
                                                help
                                            </a>
                                            </li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://support.ala.org.au/support/solutions/6000138053">ALA
                                                Tools &amp; Apps
                                                help</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://support.ala.org.au/support/solutions/6000138349">ALA
                                                Spatial Portal
                                                help</a></li>
                                            <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                                href="https://www.ala.org.au/contact-us/">Contact us</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/
                        }
                        <div className="col-md-12 padding-lr-15">

                            <div className="footer-menu-horizontal">
                                <ul id="menu-other-links" className="menu horizontal">
                                    <li className="menu-item menu-item-type-post_type menu-item-object-page current_page_parent">
                                        <a
                                            className="underline"
                                            href="https://www.ala.org.au/blog/">News &amp; media</a>
                                    </li>
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                        className="underline"
                                        href="https://support.ala.org.au/support/home">Help</a>
                                    </li>
                                    <li className="menu-item menu-item-type-custom menu-item-object-custom"><a
                                        className="underline"
                                        href="https://support.ala.org.au/support/solutions/folders/6000233596">Developer
                                        tools &amp; documentation</a></li>
                                    <li className="menu-item menu-item-type-post_type menu-item-object-page"><a
                                        className="underline"
                                        href="https://www.ala.org.au/sites-and-services/">All
                                        sites, services &amp;
                                        tools</a></li>
                                </ul>
                            </div>
                        </div>
                        {/*col end*/}
                    </div>
                    {/*row end*/}
                </div>
                {/*container end*/}
            </div>

            <div className="footer-bottom">
                <div className="container">
                    <div className="row">
                        <div className="col-md-6 content-column">
                            <h4 className={"mtb-10px"}>The ALA is made possible by contributions from its partners, is
                                supported by <a
                                    href="https://www.dese.gov.au/ncris" className="underline">NCRIS</a>,
                                is hosted by <a href="https://csiro.au/" className="underline">CSIRO</a>, and is the
                                Australian node
                                of <a href="https://www.gbif.org/en/" className="underline">GBIF</a>.</h4>
                            <p>
                                <a href="https://www.dese.gov.au/ncris"><img
                                    className="alignnone wp-image-41895 size-thumbnail"
                                    src="https://www.ala.org.au/app/uploads/2019/06/NCRIS_150px-150x109.jpg"
                                    alt="NCRIS logo" width="150" height="109"/></a>
                                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                <a href="https://csiro.au/"><img className="alignnone wp-image-41909"
                                                                 src="https://www.ala.org.au/app/uploads/2019/07/CSIRO_Solid_RGB-150x150.png"
                                                                 alt="CSIRO logo" width="109" height="109"/></a>
                                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                <a href="https://www.gbif.org/en/"><img className="alignnone size-full wp-image-41898"
                                                                        src="https://www.ala.org.au/app/uploads/2019/06/GBIF_109px.png"
                                                                        alt="GBIF logo" width="207" height="109"/></a>
                            </p>
                        </div>
                        <div className="col-md-6 content-column">
                            <h4 className={"mtb-10px"}>Acknowledgement of Traditional Owners and Country</h4>
                            <p>The Atlas of Living Australia acknowledges Australia’s Traditional Owners and pays
                                respect to the
                                past and present Elders of the nation’s Aboriginal and Torres Strait Islander
                                communities. We
                                honour and celebrate the spiritual, cultural and customary connections of Traditional
                                Owners to
                                country and the biodiversity that forms part of that country.</p>
                        </div>
                        {/*col end*/}
                    </div>
                    {/*row end*/}
                </div>
                {/*container end*/}
            </div>

            <div className="footer-copyright">
                <div className="container">
                    <div className="row">
                        <div className="col-sm-12 col-md-7 padding-lr-15">
                            <p className="alert-text text-creativecommons">
                                This work is licensed under a <a href="https://creativecommons.org/licenses/by/3.0/au/">Creative
                                Commons Attribution 3.0 Australia License</a> <a rel="license"
                                                                                 href="http://creativecommons.org/licenses/by/3.0/au/"
                                                                                 className={"cc-icon"}><img
                                alt="Creative Commons License" className={"bw-0"}
                                src="https://www.ala.org.au/app/themes/pvtl/images/cc-by.png"/></a>
                            </p>
                        </div>
                        {/*col end*/}
                        <div className="col-sm-12 col-md-5 text-md-right padding-lr-15">
                            <ul className="menu horizontal">
                                <li><a href="https://www.ala.org.au/terms-of-use/#cy">Copyright</a>
                                </li>
                                <li><a href="https://www.ala.org.au/terms-of-use/">Terms of
                                    Use</a></li>
                                <li><a href="https://status.ala.org.au/">System Status</a></li>
                            </ul>
                        </div>
                        {/*col end*/}
                    </div>
                    {/*row end*/}
                </div>
                {/*container end*/}
            </div>
        </footer>
    );
};

export default Footer;
