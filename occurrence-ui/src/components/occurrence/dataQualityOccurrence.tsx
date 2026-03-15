/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    faBan, faCheckCircle,
    faExclamationCircle,
    faQuestionCircle,
    faTimesCircle
} from "@fortawesome/free-solid-svg-icons";
import {useEffect, useRef, useState} from "react";
import {Overlay, Popover} from "react-bootstrap";
import {FormattedMessage, IntlShape, useIntl} from "react-intl";
import {DqAssertion, RecordResult, SystemAssertion} from "../../api/model.tsx";
import React from "react";
import {FontAwesomeIconLite} from '@ala/common-ui';

import dqCodesJson from '../../config/dqCodes.json';

const dqCodes: { [key: string]: DqAssertion } = dqCodesJson;

function DataQualityOccurrence({record}: { record: RecordResult }) {
    const [categories, setCategories] = useState<any[]>([]);

    const intl: IntlShape = useIntl();

    useEffect(() => {
        if (!record) {
            return;
        }

        const catList: any[] = [];

        if (record?.systemAssertions?.failed && Object.keys(record.systemAssertions.failed).length > 0) {
            catList.push({
                name: 'Failed', items: record.systemAssertions.failed, expanded: true,
                icon: <><FontAwesomeIconLite icon={faTimesCircle} style={{color: "red"}}/>
                    <FormattedMessage id="show.tabledataqualityresults.tr01td02" defaultMessage="Failed"/></>,
            });
        }

        if (record?.systemAssertions?.warning && Object.keys(record.systemAssertions.warning).length > 0) {
            catList.push({
                name: 'Warning', items: record.systemAssertions.warning, expanded: true,
                icon: <><FontAwesomeIconLite icon={faExclamationCircle} style={{color: "orange"}}/>&nbsp;
                    <FormattedMessage id="show.tabledataqualityresults.tr02td02" defaultMessage="Warning"/></>
            });
        }

        if (record?.systemAssertions?.passed && Object.keys(record.systemAssertions.passed).length > 0) {
            catList.push({
                name: 'Passed', items: record.systemAssertions.passed, expanded: false,
                icon: <><FontAwesomeIconLite icon={faCheckCircle} style={{color: "green"}}/>&nbsp;
                    <FormattedMessage id="show.tabledataqualityresults.tr03td02" defaultMessage="Passed"/></>,
                collapseTitle: intl.formatMessage({ id: "show.tabledataqualityresults.tr04td02", defaultMessage: "Show/Hide" }) + ' ' +
                    record.systemAssertions.passed.length + ' ' + intl.formatMessage({ id: "dataquality.tabledataqualityresults.tr04td02.passed", defaultMessage: "passed properties" })
            });
        }

        if (record?.systemAssertions?.missing && Object.keys(record.systemAssertions.missing).length > 0) {
            catList.push({
                name: 'Missing', items: record.systemAssertions.missing, expanded: false,
                icon: <><FontAwesomeIconLite icon={faQuestionCircle}/>&nbsp;
                    <FormattedMessage id="show.tabledataqualityresults.tr05td02" defaultMessage="Missing"/></>,
                collapseTitle: intl.formatMessage({ id: "show.tabledataqualityresults.tr05td01", defaultMessage: "Show/Hide" }) + ' ' +
                    record.systemAssertions.missing.length + ' ' + intl.formatMessage({ id: "dataquality.tabledataqualityresults.tr04td02.missing", defaultMessage: "missing properties" })
            });
        }

        if (record?.systemAssertions?.unchecked && Object.keys(record.systemAssertions.unchecked).length > 0) {
            catList.push({
                name: 'Unchecked', items: record.systemAssertions.unchecked, expanded: false,
                icon: <><FontAwesomeIconLite icon={faBan}/>&nbsp;
                    <FormattedMessage id="show.tabledataqualityresults.tr07td02"
                                      defaultMessage="Unchecked (lack of data)"/>
                </>,
                collapseTitle: intl.formatMessage({ id: "show.tabledataqualityresults.tr06td02", defaultMessage: "Show/Hide" }) + ' ' +
                    record.systemAssertions.unchecked.length + ' ' + intl.formatMessage({ id: "dataquality.tabledataqualityresults.tr07td02", defaultMessage: "tests that have not been run" })
            });
        }

        setCategories(catList);

    }, [record]);

    function Tooltip({code, children}: { code: string, children: React.ReactNode }) {
        const [show, setShow] = useState(false);
        const target = useRef(null);

        const dqItem = dqCodes[code];
        if (!dqItem) {
            return null;
        }

        return (<>
            <span ref={target} style={{cursor: "pointer"}} onClick={() => setShow(!show)}>
                {children}
            </span>
                <Overlay target={target.current} show={show} placement="right">
                    {(props) => (
                        <Popover {...props} style={{minWidth: 320, ...props.style}}>
                            <Popover.Header style={{whiteSpace: "nowrap"}}>{dqItem.name}</Popover.Header>
                            <Popover.Body>
                                <div>{dqItem.description}</div>
                                <div><a href={import.meta.env.VITE_DATA_QUALITY_WIKI_URL + dqItem.name} target="wiki"
                                        title="More details on the wiki page">
                                    <FormattedMessage id="dataquality.tooltip.wikilink" defaultMessage="Wiki page"/>
                                </a></div>
                            </Popover.Body>
                        </Popover>
                    )}
                </Overlay>
            </>
        );
    }

    function formatCode(code: string) {
        // return <FontAwesomeIconLite icon={faQuestionCircle} title={code} style={{color: '#c44d34', opacity: 0.5}} />;
        return <Tooltip code={code}>
            <FontAwesomeIconLite icon={faQuestionCircle} title={code} style={{color: '#c44d34', opacity: 0.5}}/>
        </Tooltip>
    }

    return (
        <div id="dataQualityInfo" className="additionalData">
            <h3><FormattedMessage id="show.dataquality.title" defaultMessage="Data quality tests"/></h3>
            <table className="dataQualityResults table table-striped table-bordered table-condensed">
                <thead>
                <tr className="sectionName">
                    <td className="dataQualityTestName">
                        <FormattedMessage id="show.tabledataqualityresultscol01.title" defaultMessage="Test name"/>
                    </td>
                    <td className="dataQualityTestResult">
                        <FormattedMessage id="show.tabledataqualityresultscol02.title" defaultMessage="Result"/>
                    </td>
                </tr>
                </thead>
                <tbody>
                {categories.map((category, idx) => (<React.Fragment key={idx}>
                        {category.collapseTitle &&
                            <tr>
                                <td colSpan={2}>
                                    <a href={'#'} style={{fontWeight: "bold"}}
                                       onClick={(e) => {
                                           e.preventDefault();
                                           categories[idx].expanded = !categories[idx].expanded;
                                           setCategories([...categories]);
                                       }}>
                                        {category.collapseTitle}
                                    </a>
                                </td>
                            </tr>
                        }
                        {category.expanded && category.items.map((item: SystemAssertion, idx: number) => (
                            <tr key={idx}>
                                <td>
                                    <FormattedMessage id={'assertions.' + item.name} defaultMessage={item.name}/>
                                    &nbsp;{formatCode(item.code)}
                                </td>
                                <td>
                                    {category.icon}
                                </td>
                            </tr>
                        ))}
                    </React.Fragment>
                ))}
                </tbody>
            </table>
        </div>
    );
}

export default DataQualityOccurrence;
