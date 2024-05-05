import {useState} from "react";
import {FormattedMessage} from "react-intl";

function formatNumber(number) {
    if (isNaN(number / 1.0)) {
        return number
    }
    var n = number
    var s = ''
    if (number > 1000000000) {
        n = number / 1000000000.0
        s = 'B'
    } else if (number > 1000000) {
        n = number / 1000000.0
        s = 'M'
    }

    // format n to 2 decimal places
    n = Math.round(n * 100) / 100

    return new Intl.NumberFormat('en').format(n) + s
}

const TreeRow = ({row, level}) => {
    const [showList, setShowList] = useState(false);
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    const kingdomTree = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'subspecies']

    const getTreeDataBranch = (fq, level) => {
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
                <div style={{marginLeft: (level * 10) + 'px'}} className="me-1">
                    {loading ?
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        :
                        showList ?
                            (list.length > 0 ?
                                    <i className="bi-chevron-down"
                                       onClick={() => {
                                           setShowList(false);
                                       }}></i>
                                    :
                                    <i className="bi-dash"></i>
                            )
                            : (level < kingdomTree.length - 1 ?
                                <i className="bi-chevron-right"
                                   onClick={() => {
                                       getTreeDataBranch(row.fq, level + 1)
                                   }}></i>
                                :
                                <i className="bi-dash"></i>
                            )
                    }
                </div>
                <FormattedMessage id={row.label}/> - {formatNumber(row.count)}
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

const Tree = ({level, list}) => {
    return <table className="dashboardTree">
        <tbody>{list.map((row, index) => <TreeRow key={index} row={row} level={level}/>)}</tbody>
    </table>
}

export default Tree;
