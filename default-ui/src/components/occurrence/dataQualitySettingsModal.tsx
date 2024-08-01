// import Modal from "react-bootstrap/esm/Modal";
import {useContext, useEffect, useState} from "react";
import {DataQualityInfo, ListsUser} from "../../api/sources/model.ts";
import UserContext from "../../helpers/UserContext.ts";

interface DataQualitySettingsProps {
    onClose: () => void,
    dataQualityInfo: DataQualityInfo,
    dataQuality: any[],
    queryString: string | undefined
}

function DataQualitySettingsModal({
                                      onClose,
                                      dataQualityInfo,
                                      dataQuality,
                                      queryString,
                                  }: DataQualitySettingsProps) {

    const currentUser = useContext(UserContext) as ListsUser;

    const [localCategories, setLocalCategories] = useState<any[]>([]);
    const [profile, setProfile] = useState(dataQualityInfo.profile);
    const [showExpanded, setShowExpanded] = useState(dataQualityInfo.expand ? "expanded": "collapsed");

    useEffect(() => {
        updateLocalCategories();
    }, [dataQualityInfo, profile]);

    function updateLocalCategories() {
        let selectedCategories: string[] | undefined = dataQualityInfo.selectedFilters;
        let categories: any[] = [];
        for (let dq of dataQuality) {
            if (dq.shortName === profile) {
                for (let cat of dq.categories) {
                    let hasDisableParam =  (queryString?.includes("disableQualityFilter=" + cat.label + "&") ||
                        queryString?.endsWith("disableQualityFilter=" + cat.label))
                    let selected = (selectedCategories === undefined || selectedCategories.includes(cat.name)) &&
                        !hasDisableParam;
                    categories.push({
                        name: cat.name,
                        label: cat.label,
                        selected: selected
                    });
                }
            }
        }
        setLocalCategories(categories);
    }

    function save() {
        let disabledItems :string[] = localCategories.filter(cat => !cat.selected).map(cat => cat.label);

        const data = new URLSearchParams();
        data.append("name", import.meta.env.VITE_APP_NAME + ".dqUserProfile" );
        data.append("value", JSON.stringify({
            expand: showExpanded,
            disableAll: profile === "disable",
            disabledItems: disabledItems,
            dataProfile: profile === "disable" ? null : profile}));
        data.append("alaId", currentUser?.userId());

        if (!currentUser?.user()) {
            // TODO: save to local storage
        } else {
            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property", {
                method: 'POST',
                body: data,
                headers: {
                    'Authorization': 'Bearer ' + currentUser?.user()?.access_token,
                }
            })
        }

        onClose();
    }

    return <>
        <Modal show={true} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Data profile user settings</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="container-fluid">
                    <p>Your default profile is applied to searches unless you select another profile from the data
                        profiles
                        drop down.</p>

                    <div className="row align-items-center ps-0">
                        <label className="col-md-6 control-label fw-bold" htmlFor="dataQualitySelect">Default profile</label>
                        <div className="col-md-6">
                            <div id="dataQualitySelect" className="form-control border-0 no-wrap">
                                <select className="form-select form-select-sm" value={profile}
                                        onChange={(e) => setProfile(e.target.value)}>
                                    {dataQuality.map((dq, index) =>
                                        <option key={index} value={dq.shortName}
                                                title="Click to switch profile">{dq.name}</option>
                                    )}
                                    <option value="disable">Disable data profiles</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="row align-items-center ps-0 mb-2">
                        <label className="col-md-6 control-label fw-bold" htmlFor="showSelect">Show data profile
                            details</label>
                        <div className="col-md-6">
                            <div id="showSelect" className="form-control border-0 no-wrap">
                                <select className="form-select form-select-sm" value={showExpanded}
                                        onChange={(e) => setShowExpanded(e.target.value)}>
                                    <option value="collapsed">Collapsed</option>
                                    <option value="expanded">Expanded</option>
                                </select>
                            </div>
                        </div>
                    </div>


                    {localCategories.map((cat, idx) =>
                        <div key={idx} className="row align-items-center ps-0 mb-3">
                            <label className="col-md-8 control-label fw-bold" htmlFor="dataQualitySelect">{cat.name}</label>
                            <div className="col-md-4">
                                <div className="d-flex no-wrap">
                                    <input type="checkbox" checked={cat.selected} onChange={(e) => {
                                        cat.selected = e.target.checked;
                                        setLocalCategories([...localCategories]);
                                    }}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn btn-default btn-sm border-black" onClick={() => onClose()}>Cancel</button>
                <button id="updateFacetOptions" className="btn btn-primary btn-sm" onClick={() => save()}>Save
                </button>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualitySettingsModal;
