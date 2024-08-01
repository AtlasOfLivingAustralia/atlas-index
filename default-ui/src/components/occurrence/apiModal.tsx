// import Modal from "react-bootstrap/esm/Modal";

interface ApiModalProps {
    onClose: () => void
    url: string
}

function ApiModal({onClose, url}: ApiModalProps) {
    function copy() {
        // copy "url" to clipboard
        navigator.clipboard.writeText(url)
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>JSON web service API</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="input-group input-group-sm align-content-end">
                    <input type="text" className="form-control mt-2" readOnly={true} disabled={true}
                           value={url}
                    />
                    <button className="btn border-black mt-2"
                            onClick={() => copy()}>Copy URL</button>
                </div>
            </Modal.Body>
        </Modal>
    </>
}

export default ApiModal;

// import React from "react";
//
// <div id="CopyLink" className="modal fade" role="dialog"
//     // tabIndex="-1"
// >
//     <div className="modal-dialog" role="document">
//         <div className="modal-content">
//             <div className="modal-header">
//                 <button type="button" className="close" data-dismiss="modal"
//                         aria-hidden="true">×
//                 </button>
//                 <h3>JSON web service API</h3>
//             </div>
//             <div className="modal-body">
//                 <div className="col-sm-12 input-group">
//                     {/*<input type="text" className="form-control"*/}
//                     {/*       value={simpleTaxa}*/}
//                     {/*       onChange={e => setSimpleTaxa(e.target.value)}/>*/}
//                     {/*<button className="btn btn-primary"*/}
//                     {/*        onClick={() => simpleSearch()}>Search*/}
//                     {/*</button>*/}
//                     <input type="text" className="form-control"
//                            value="https://biocache-ws.ala.org.au/ws/occurrences/search?q=taxa%3A%22forg%22&amp;qualityProfile=ALA&amp;qc=-_nest_parent_%3A*"
//                            id="al4rcode"
//                         // readOnly=""/
//                     />
//                     <span className="input-group-btn">
//                                                         <button className="form-control btn" id="copy-al4r">
//                                                             Copy URL
//                                                         </button>
//                                                     </span>
//                 </div>
//             </div>
//         </div>
//     </div>
// </div>
