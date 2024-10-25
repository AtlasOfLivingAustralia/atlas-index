import {ChevronDownIcon, ChevronRightIcon, DotsThreeIcon} from "@atlasoflivingaustralia/ala-mantine";
import {useState} from "react";
import {FormattedMessage} from "react-intl";
import "./dashboard.css";

function formatNumber(number: any) {
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
                        <DotsThreeIcon />
                        :
                        showList ?
                            (list.length > 0 ?
                                    <ChevronDownIcon
                                        onClick={() => {
                                            setShowList(false);
                                        }}/>
                                    :
                                    <div>-</div>
                            )
                            : (level < kingdomTree.length - 1 ?
                                    <ChevronRightIcon
                                        onClick={() => {
                                            getTreeDataBranch(row.fq, level + 1)
                                        }}/>
                                    :
                                    <div>-</div>
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

const Tree = ({level, list}: { level: number, list: any }) => {
    return <table className="dashboardTree">
        <tbody>{list.map((row: any, index: number) => <TreeRow key={index} row={row} level={level}/>)}</tbody>
    </table>
}

export default Tree;
