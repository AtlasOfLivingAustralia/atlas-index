/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import DOMPurify from "dompurify";
import classes from "./species.module.css";
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import {TaxonDescription} from "../../api/sources/model.ts";
import InfoBox from "../common-ui/infoBox.tsx";

interface MapViewProps {
    descriptions?: TaxonDescription[];
}

function DescriptionView({descriptions}: MapViewProps) {

    return <div className="descriptionPage">
        <InfoBox icon={faCircleInfo} title="About descriptions"
                 content={<>Descriptive content has been sourced from several authoritative sources of information e.g.
                     museums and herbaria. Links to further information are included in each section.</>}/>

        <div style={{height: "30px"}}/>
        {descriptions === undefined &&
            <div className="placeholder-glow">
                <span className="placeholder" style={{height: 40, display: "block", width: "300px"}}></span>
                <span className="placeholder" style={{height: 32, display: "block", width: "180px", marginTop: "30px"}}></span>
                <span className="placeholder" style={{height: 48, display: "block", width: "500px", marginTop: "15px"}}></span>
                <span className="placeholder" style={{height: 24, display: "block", width: "100px"}}></span>
                <span className="placeholder" style={{height: 32, display: "block", width: "180px", marginTop: "30px"}}></span>
                <span className="placeholder" style={{height: 48, display: "block", width: "500px", marginTop: "15px"}}></span>
                <span className="placeholder" style={{height: 24, display: "block", width: "100px"}}></span>
                <span className="placeholder" style={{height: 32, display: "block", width: "600px", marginTop: "30px"}}></span>
            </div>
        }
        {descriptions && descriptions.map((description, idx) =>
            <div key={idx}>
                {idx > 0 && <hr style={{marginTop: "40px", marginBottom: "40px"}}/>}
                <span className={classes.speciesDescriptionTitle}>{description.name}</span>
                {description && Object.keys(description).map((key, idx) =>
                    // if key is not in the list of keys to display, skip
                    !['name', 'attribution', 'url'].includes(key) &&
                    <div key={idx} className={classes.speciesSection} style={{paddingTop: "30px"}}>
                        {/* The title 'summary' is present only on wikipedia data and should be suppressed */}
                        {'summary' !== key && <span style={{marginBottom: "15px"}} className={classes.speciesDescriptionSection}>{key}</span>}
                        {/* Leaving this header 'just in case'. taxon-descriptions does sanitize this content. */}
                        <div className={classes.speciesSectionText}
                             dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(description[key])}}/>
                    </div>
                )}
                <div className="d-flex align-items-center gap-2 mt-3">
                    <span>Source: </span>
                    <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(description.attribution)}}></span>
                </div>
            </div>
        )}
        {descriptions && descriptions.length === 0 &&
            <span>No descriptions found</span>
        }
    </div>
}

export default DescriptionView;
