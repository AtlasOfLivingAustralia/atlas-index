/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState} from "react";
import {FormattedMessage} from "react-intl";
import "./dashboard.css";
import FontAwesomeIcon from '../common-ui/fontAwesomeIconLite'
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'
import {faChevronDown} from '@fortawesome/free-solid-svg-icons/faChevronDown'
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner'
import {formatNumber} from "../util/FormatNumber.tsx";

const TreeRow = ({row, level}: { row: any, level: number }) => {
    const [showList, setShowList] = useState(false);
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    const kingdomTree = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'subspecies']

    const getTreeDataBranch = (fq: any, level: number) => {
        setLoading(true)
        fetch(import.meta.env.VITE_APP_BIOCACHE_URL + '/occurrence/facets?q=' + fq + '&facets=' + kingdomTree[level] + '&flimit=-1&facet=true')
            .then(response => response.json()).then(json => {
                if (json && json[0] && json[0].fieldResult) {
                    setList(json[0].fieldResult)
                    setShowList(true)
                } else {
                    setList([])
                    setShowList(true)
                }
                setLoading(false)
            }
        );
    }

    return <>
        <tr>
            <td className="d-flex">
                <div style={{marginLeft: (level * 10) + 'px', marginRight: '10px', display: "inline-flex"}}>
                    {loading ?
                        <div><FontAwesomeIcon icon={faSpinner}/></div>
                        :
                        showList ?
                            (list.length > 0 ?
                                    <div
                                        onClick={() => {
                                            setShowList(false);
                                        }}><FontAwesomeIcon icon={faChevronDown}/></div>
                                    :
                                    <div>-</div>
                            )
                            : (level < kingdomTree.length - 1 ?
                                    <div
                                        onClick={() => {
                                            getTreeDataBranch(row.fq, level + 1)
                                        }}><FontAwesomeIcon icon={faChevronRight}/></div>
                                    :
                                    <div>-</div>
                            )
                    }
                </div>
                {row.label && <FormattedMessage id={row.label}/>} - {formatNumber(row.count)}
            </td>
            <td></td>
        </tr>
        <tr>
            <td colSpan={3} style={{marginLeft: (level * 5)}}>
                {showList &&
                    <Tree level={level + 1} list={list}/>}
            </td>
        </tr>
    </>
}

const Tree = ({level, list}: { level: number, list: any }) => {
    return <table className="dashboardTree">
        <tbody>{list.map((row: any, index: number) => <TreeRow key={index} row={row} level={level}/>)}</tbody>
    </table>
}

export default Tree;
