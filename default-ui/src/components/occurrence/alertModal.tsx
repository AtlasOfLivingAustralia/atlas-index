// import Modal from "react-bootstrap/Modal";

interface AlertModalProps {
    onClose: () => void,
    results: any,
    queryString: string | undefined
}

function AlertModal({onClose, results, queryString}: AlertModalProps) {

    function createNewRecordAlert() {
        createAlert('createBiocacheNewRecordsAlert')
    }

    function createNewAnnotationsAlert() {
        createAlert('createBiocacheNewAnnotationsAlert')
    }

    function createAlert(method: string) {
        // this would be better as a POST service, but I guess this works
        let url = "https://alerts-test.ala.org.au/ws/" + method;
        if (results.queryTitle.length >= 250) {
            url += "?queryDisplayName=" + encodeURIComponent(results.queryTitle.substring(0, 149) + "...");
        } else {
            url += "?queryDisplayName=" + encodeURIComponent(results.queryTitle);
        }
        url += "&baseUrlForWS=" + encodeURIComponent(import.meta.env.VITE_APP_BIOCACHE_URL);
        url += "&baseUrlForUI=" + encodeURIComponent(import.meta.env.VITE_OIDC_REDIRECT_URL);
        url += "&webserviceQuery=%2Foccurrences%2Fsearch%3F" + encodeURIComponent(queryString || '');
        url += "&uiQuery=%23%2Foccurrences%2Fsearch%3F" + encodeURIComponent(queryString || '');
        url += "&resourceName=" + encodeURIComponent(import.meta.env.VITE_ORG_NAME);

        window.location.href = url;
    }

    return <>
        <Modal show={true} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Email alerts</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="btn border-black"
                     title="Notify me when new records come online for this search"
                     onClick={() => createNewRecordAlert()}>
                    Get email alerts for new <u>records</u>
                </div>
                <br/>

                <div className="btn border-black mt-4"
                     title="Notify me when new annotations (corrections, comments, etc) come online for this search"
                     onClick={() => createNewAnnotationsAlert()}>Get email alerts for new <u>annotations</u>
                </div>
                <p>&nbsp;</p>
                <p><a href="https://alerts.ala.org.au/notification/myAlerts">View your current alerts</a></p>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn border-black" onClick={() => onClose()}>Close
                </button>
            </Modal.Footer>
        </Modal>
    </>
}

export default AlertModal;
