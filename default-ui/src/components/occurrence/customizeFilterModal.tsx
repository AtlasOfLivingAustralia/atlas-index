import Modal from "react-bootstrap/esm/Modal";
import {useState} from "react";

interface ApiModalProps {
    onClose: () => void,
    facetList: string[],
    setFacetList: (value: (((prevState: string[]) => string[]) | string[])) => void,
    groupedFacets: any[]
}

function CustomizeFilterModal({onClose, facetList, setFacetList, groupedFacets}: ApiModalProps) {

    const [localFacetList, setLocalFacetList] = useState(facetList);
    const defaultFacets = ['kingdom', 'basisOfRecord'];

    function update() {
        setFacetList([...localFacetList])
        onClose();
    }

    function reset() {
        setFacetList(defaultFacets);
        onClose();
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Customise filters<span
                    id="customiseFacetsHint">(scroll to see full list)</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div id="facetCheckboxes" className="container-fluid">
                    {groupedFacets && groupedFacets.map((group: any, idx) =>
                        <div key={idx} className="row">
                            <div className="col-12">
                                <div className="facetGroupName mb-2">{group.title}</div>
                            </div>

                            <div className="col-12 ps-1">
                                <div className="d-flex flex-wrap">
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
                                            &nbsp;{facet.field}
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
                <button id="resetFacetOptions" className="btn btn-default btn-sm margin-left-5 border-black"
                        onClick={() => reset()}>Reset to defaults
                </button>
                <button className="btn btn-default btn-sm border-black" onClick={() => onClose()}>Close</button>
                <button id="updateFacetOptions" className="btn btn-primary btn-sm" onClick={() => update()}>Update
                </button>
            </Modal.Footer>
        </Modal>
    </>
}

export default CustomizeFilterModal;
