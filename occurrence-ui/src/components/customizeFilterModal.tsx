/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Modal from "react-bootstrap/esm/Modal";
import {useState} from "react";
import {FormattedMessage} from "react-intl";
import defaultFacets from "../config/defaultFacets.json";

interface ApiModalProps {
    onClose: () => void,
    facetList: string[],
    setFacetList: (value: (((prevState: string[]) => string[]) | string[])) => void,
    groupedFacets: any[]
}

function CustomizeFilterModal({onClose, facetList, setFacetList, groupedFacets}: ApiModalProps) {

    const [localFacetList, setLocalFacetList] = useState(facetList);

    function update() {
        setFacetList([...localFacetList])

        // save to local storage
        localStorage.setItem('customFacets', JSON.stringify(localFacetList));

        onClose();
    }

    function reset() {
        setFacetList(defaultFacets);
        onClose();
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>
                    <FormattedMessage id="list.customisefacetsbutton.div01.title" defaultMessage="Customise filter options"/>
                    &nbsp;<FormattedMessage id="list.customisefacetsbutton.title.hint" defaultMessage="Scroll to see full list"/>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div id="facetCheckboxes" className="container-fluid">
                    {groupedFacets && groupedFacets.map((group: any, idx) =>
                        <div key={idx} className="row">
                            <div className="col-12">
                                <div className="facetGroupName mb-2"><FormattedMessage id={"facet.group." + group.title} defaultMessage={group.title}/></div>
                            </div>

                            <div className="col-12">
                                <div className="d-flex flex-wrap" style={{marginLeft: "-10px"}}>
                                    {group.facets.map((facet: any, idx: number) =>
                                        <div key={idx} className="w-50">
                                            <input type="checkbox" name="facets" className="facetOpts"
                                                   value={facet.field} checked={localFacetList.includes(facet.field)}
                                                   onChange={(e) => {
                                                       if (e.target.checked) {
                                                           setLocalFacetList([...localFacetList, facet.field]);
                                                       } else {
                                                           setLocalFacetList(localFacetList.filter((f) => f !== facet.field));
                                                       }
                                                   }}
                                            />
                                            &nbsp;<FormattedMessage id={"facet." + facet.field} defaultMessage={facet.field}/>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {idx < groupedFacets.length - 1 && <hr className="w-100 mt-3"/>}
                        </div>
                    )}

                </div>
            </Modal.Body>
            <Modal.Footer>
                <button id="resetFacetOptions" className="btn btn-outline-dark margin-left-5"
                        onClick={() => reset()}><FormattedMessage id="list.facetcheckboxes.button.resetfacetoptions" defaultMessage="Reset to defaults"/></button>
                <button className="btn btn-outline-dark" onClick={() => onClose()}><FormattedMessage id="list.facetcheckboxes.button.closeFacetoptions" defaultMessage="Close"/></button>
                <button id="updateFacetOptions" className="btn btn-primary" onClick={() => update()}><FormattedMessage id="list.facetcheckboxes.button.updatefacetoptions" defaultMessage="Update"/></button>
            </Modal.Footer>
        </Modal>
    </>
}

export default CustomizeFilterModal;
