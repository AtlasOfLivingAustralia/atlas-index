/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {QualityFilter} from '../../api/sources/model.ts';

function QualityFilterItem(props: {
    filter: QualityFilter; // clone of the filter to avoid modifying the original object directly
    actualFilter: QualityFilter | undefined; // actual filter item that is being edited
    resetInverseFilter: () => void;
    setProfileDirty: (dirty: boolean) => void;
    deleteFilterItem: (id: number) => void;
}) {
    const [filterItem, setFilterItem] = useState<QualityFilter>(props.filter);

    useEffect(() => {
        setFilterItem(props.filter);
    }, [props.filter]);

    function setEnabled(enabled: boolean) {
        // update display
        filterItem.enabled = enabled;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.actualFilter) {
            props.actualFilter.enabled = enabled;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter();
    }

    function setDisplayOrder(displayOrder: number) {
        // update display
        filterItem.displayOrder = displayOrder;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.actualFilter) {
            props.actualFilter.displayOrder = displayOrder;
            props.setProfileDirty(true);
        }

        // no need to reset inverse filter
    }

    function setFilter(filter: string) {
        // update display
        filterItem.filter = filter;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.actualFilter) {
            props.actualFilter.filter = filter;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter();
    }

    function setDescription(description: string) {
        // update display
        filterItem.description = description;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.actualFilter) {
            props.actualFilter.description = description;
            props.setProfileDirty(true);
        }
    }

    function setInverseFilter(inverseFilter: string) {
        // update display
        filterItem.inverseFilter = inverseFilter;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.actualFilter) {
            props.actualFilter.inverseFilter = inverseFilter;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter();
    }

    return (
        <>
            <tr>
                <td>
                    <input
                        type="checkbox"
                        checked={filterItem.enabled}
                        onChange={() => setEnabled(!filterItem.enabled)}
                        className={"me-1"}
                    ></input>
                    ({filterItem.id > 1_000_000 ? 'new' : 'id: ' + filterItem.id})
                </td>
                <td>
                    <input
                        type="number"
                        value={filterItem.displayOrder}
                        style={{width:'50px'}}
                        onChange={(e) => setDisplayOrder(Number(e.target.value))}
                        className={"me-1"}
                    ></input>
                </td>
                <td>
                    <textarea
                        rows={3}
                        value={filterItem.filter}
                        className="w-100"
                        style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </td>
                <td>
                    <textarea
                        rows={3}
                        value={filterItem.inverseFilter}
                        className="w-100"
                        style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
                        onChange={(e) => setInverseFilter(e.target.value)}
                    />
                </td>
                <td>
                    <textarea
                        rows={3}
                        value={filterItem.description}
                        className="w-100"
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </td>
                <td>
                    <button
                        className="btn border-black btn-danger ms-auto"
                        onClick={() => {
                            props.deleteFilterItem(filterItem.id);
                        }}
                    >
                        Delete
                    </button>
                </td>
            </tr>
        </>
    );
}

export default QualityFilterItem;
