/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";
import Modal from "react-bootstrap/esm/Modal";
import {FormattedMessage} from "react-intl";
import { DataQualityInfo, QualityProfile } from '../api/model.tsx';
import React from 'react';

interface DataQualityInfoModalProps {
    onClose: () => void,
    dataQualityInfo: DataQualityInfo,
    dataQuality: any[]
}

function DataQualityInfoModal({onClose, dataQualityInfo, dataQuality}: DataQualityInfoModalProps) {

    const [data, setData] = useState<QualityProfile | undefined>(undefined);

    useEffect(() => {
        for (let dq of dataQuality) {
            if (dq.shortName === dataQualityInfo.profile) {
                setData(dq)
            }
        }
    }, [dataQualityInfo]);

    function infoUrl(fq: string) {
        let match = fq.match(/-?assertions:(\w+)/);
        if (match && match.length > 1) {
            return import.meta.env.VITE_APP_DQ_WIKI_URL + match[1];
        }

        match = fq.match(/-?(\w+):/);
        if (match && match.length > 1) {
            return import.meta.env.VITE_APP_DQ_WIKI_URL + match[1];
        }

        return null;
    }
    return <>
        <Modal show={true} onHide={onClose} size="xl">
            <Modal.Header closeButton>
            </Modal.Header>
            <Modal.Body>
                <h4 className="dqH4"><FormattedMessage id="dq.profiledetail.title" defaultMessage="Data quality profile description"/></h4>
                <table className="table table-bordered table-condensed table-striped">
                    <tbody>
                    <tr>
                        <td><FormattedMessage id="dq.profiledetail.profiletable.header.profilename" defaultMessage="Profile name"/></td>
                        <td>{data?.name}</td>
                    </tr>
                    <tr>
                        <td><FormattedMessage id="dq.profiledetail.profiletable.header.profileshortname" defaultMessage="Profile short name"/></td>
                        <td>{data?.shortName}</td>
                    </tr>
                    <tr>
                        <td><FormattedMessage id="dq.profiledetail.profiletable.header.profiledescription" defaultMessage="Profile description"/></td>
                        <td>{data?.description}</td>
                    </tr>
                    <tr>
                        <td><FormattedMessage id="dq.profiledetail.profiletable.header.owner" defaultMessage="Owner"/></td>
                        <td>{data?.contactName}</td>
                    </tr>
                    <tr>
                        <td><FormattedMessage id="dq.profiledetail.profiletable.header.contact" defaultMessage="Contact"/></td>
                        <td><a target="_blank" href={"mailto: " + (data?.contactEmail)}>{data?.contactEmail}</a>
                        </td>
                    </tr>
                    </tbody>
                </table>

                <h4 className="dqH4"><FormattedMessage id="dq.profiledetail.categorylabel" defaultMessage="Filter categories"/>:</h4>

                {data?.categories && data.categories.map((cat, idx) => <React.Fragment key={idx}>
                    <div className="dqCategory">
                        <b>{cat.name}</b><br/>
                        <div className="dqCategoryDesc">{cat.description}</div>
                    </div>
                    <table
                        className="table cat-table table-bordered table-condensed table-striped">
                        <tbody>
                        <tr>
                            <th><FormattedMessage id="dq.profiledetail.filtertable.header.description" defaultMessage="Filter description"/></th>
                            <th><FormattedMessage id="dq.profiledetail.filtertable.header.value" defaultMessage="Filter value"/></th>
                            <th><FormattedMessage id="dq.profiledetail.filtertable.header.furtherInfo" defaultMessage="Further information"/></th>
                        </tr>

                        {cat.qualityFilters.map((filter, idx) =>
                            <tr key={idx}>
                                <td className="filter-description">
                                    {filter.description}
                                </td>
                                <td className="filter-value no-wrap">
                                    {filter.filter}</td>
                                <td className="filter-wiki">
                                    {infoUrl(filter.filter) && <a href={infoUrl(filter.filter) || ''} target="_blank">
                                        <FormattedMessage id="dq.categoryinfo.dlg.fieldtable.value.link" defaultMessage="Link"/>
                                    </a>}
                                </td>
                            </tr>
                        )}

                        </tbody>
                    </table>

                </React.Fragment>)}

            </Modal.Body>
            <Modal.Footer>
                <div className="d-flex w-100">
                    <a href={import.meta.env.VITE_APP_DQ_INFO_URL} target="_blank">
                        <FormattedMessage id="dq.warning.dataprofile.buttonleft.text" defaultMessage="Learn More"/>
                    </a>

                    <button className="btn btn-outline-dark ms-auto" onClick={() => onClose()}>
                        <FormattedMessage id="dq.categoryinfo.dlg.closebutton.text" defaultMessage="Close"/>
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualityInfoModal;
