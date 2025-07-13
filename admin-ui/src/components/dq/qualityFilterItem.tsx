import { QualityFilter } from '../../api/sources/model.ts';
import { useEffect, useState } from 'react';

function QualityFilterItem(props: {
    filter: QualityFilter;
    parentFilter: QualityFilter | undefined;
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
        if (props.parentFilter) {
            props.parentFilter.enabled = enabled;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter();
    }

    function setFilter(filter: string) {
        // update display
        filterItem.filter = filter;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.parentFilter) {
            props.parentFilter.filter = filter;
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
        if (props.parentFilter) {
            props.parentFilter.description = description;
            props.setProfileDirty(true);
        }
    }

    function setInverseFilter(inverseFilter: string) {
        // update display
        filterItem.inverseFilter = inverseFilter;
        setFilterItem({ ...filterItem });

        // update parent
        if (props.parentFilter) {
            props.parentFilter.inverseFilter = inverseFilter;
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
                    (id: {filterItem.id})
                </td>
                <td>
                    <input
                        type="text"
                        value={filterItem.filter}
                        className="w-100"
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </td>
                <td>
                    <input
                        type="text"
                        value={filterItem.inverseFilter}
                        className="w-100"
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
