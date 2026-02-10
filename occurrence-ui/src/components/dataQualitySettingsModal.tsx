/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useUser} from "@ala/common-ui";
import Modal from "react-bootstrap/esm/Modal";
import {useEffect, useState} from "react";
import { FormattedMessage, IntlShape, useIntl } from 'react-intl';
import {DataQualityInfo} from "../api/model.tsx";

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

    const {userInfo} = useUser();

    const [localCategories, setLocalCategories] = useState<any[]>([]);
    const [profile, setProfile] = useState(dataQualityInfo.profile);
    const [showExpanded, setShowExpanded] = useState(dataQualityInfo.expand ? "expanded": "collapsed");

    const intl: IntlShape = useIntl();

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

        if (!userInfo?.authenticated) {
            // TODO: save to local storage
        } else {
            const data = new URLSearchParams();
            data.append("name", import.meta.env.VITE_APP_NAME + ".dqUserProfile" );
            data.append("value", JSON.stringify({
                expand: showExpanded,
                disableAll: profile === "disable",
                disabledItems: disabledItems,
                dataProfile: profile === "disable" ? null : profile}));
            data.append("alaId", userInfo?.userId || "guest");

            fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/user/property", {
                method: 'POST',
                body: data,
                headers: {
                    'Authorization': 'Bearer ' + userInfo?.accessToken,
                }
            })
        }

        onClose();
    }

    return <>
        <Modal show={true} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title><FormattedMessage id="dq.prefsettings.dlg.title" defaultMessage="Data profile user settings"/></Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="container-fluid">
                    <p><FormattedMessage id="dq.profilesettings.warning.appliedtosearch" defaultMessage="Your default profile is applied to searches unless you select another profile from the data profiles drop down"/></p>

                    <div className="row align-items-center ps-0">
                        <label className="col-md-6 control-label fw-bold" htmlFor="dataQualitySelect">
                            <FormattedMessage id="dq.profilesettings.label.defaultprofile" defaultMessage="Default profile"/>
                        </label>
                        <div className="col-md-6">
                            <div id="dataQualitySelect" className="form-control border-0 no-wrap">
                                <select className="form-select form-select-sm" value={profile}
                                        onChange={(e) => setProfile(e.target.value)}>
                                    {dataQuality.map((dq, index) =>
                                        <option key={index} value={dq.shortName} title={intl.formatMessage({id: "dq.click.to.switch.profiles", defaultMessage:"Click to switch profile"})}>{dq.name}</option>
                                    )}
                                    <option value="disable"><FormattedMessage id="dq.buttontext.disableall" defaultMessage="Disable data profiles"/></option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="row align-items-center ps-0 mb-2">
                        <label className="col-md-6 control-label fw-bold" htmlFor="showSelect">
                            <FormattedMessage id="dq.profilesettings.label.showexpend" defaultMessage="Show data profile details"/>
                        </label>
                        <div className="col-md-6">
                            <div id="showSelect" className="form-control border-0 no-wrap">
                                <select className="form-select form-select-sm" value={showExpanded}
                                        onChange={(e) => setShowExpanded(e.target.value)}>
                                    <option value="collapsed"><FormattedMessage id="dq.profilesettings.select.option.collapsed" defaultMessage="Collapsed" /></option>
                                    <option value="expanded"><FormattedMessage id="dq.profilesettings.select.option.expanded" defaultMessage="Expanded" /></option>
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
                <button className="btn btn-default btn-sm border-black" onClick={() => onClose()}>
                    <FormattedMessage id="dq.profilesettings.button.cancel" defaultMessage="Cancel"/>
                </button>
                <button id="updateFacetOptions" className="btn btn-primary btn-sm" onClick={() => save()}>
                    <FormattedMessage id="dq.profilesettings.button.save" defaultMessage="Save"/>
                </button>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualitySettingsModal;
