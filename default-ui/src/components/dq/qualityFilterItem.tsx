import {QualityFilter} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import {TableTd, TableTr, Textarea} from "@mantine/core";

function QualityFilterItem(props: {
    filter: QualityFilter,
    parentFilter: QualityFilter | undefined,
    resetInverseFilter: () => void,
    setProfileDirty: (dirty: boolean) => void
}) {
    const [filterItem, setFilterItem] = useState<QualityFilter>(props.filter);

    useEffect(() => {
        setFilterItem(props.filter);
    }, [props.filter]);

    function setEnabled(enabled: boolean) {
        // update display
        filterItem.enabled = enabled;
        setFilterItem({...filterItem});

        // update parent
        if (props.parentFilter) {
            props.parentFilter.enabled = enabled;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter()
    }

    function setFilter(filter: string) {
        // update display
        filterItem.filter = filter;
        setFilterItem({...filterItem});

        // update parent
        if (props.parentFilter) {
            props.parentFilter.filter = filter;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter()
    }

    function setDescription(description: string) {
        // update display
        filterItem.description = description;
        setFilterItem({...filterItem});

        // update parent
        if (props.parentFilter) {
            props.parentFilter.description = description;
            props.setProfileDirty(true);
        }
    }

    function setInverseFilter(inverseFilter: string) {
        // update display
        filterItem.inverseFilter = inverseFilter;
        setFilterItem({...filterItem});

        // update parent
        if (props.parentFilter) {
            props.parentFilter.inverseFilter = inverseFilter;
            props.setProfileDirty(true);
        }

        // reset inverse filter
        props.resetInverseFilter()
    }

    return <>
        <TableTr>
            <TableTd>
                <input type="checkbox" checked={filterItem.enabled}
                       onChange={() => setEnabled(!filterItem.enabled)}></input>({filterItem.id})
            </TableTd>
            <TableTd>
                <Textarea value={filterItem.filter}
                      cols={50}
                       onChange={e => setFilter(e.target.value)}/>
            </TableTd>
            <TableTd>
                <Textarea value={filterItem.inverseFilter}
                          cols={50}
                       onChange={e => setInverseFilter(e.target.value)}/>
            </TableTd>
            <TableTd>
                <Textarea value={filterItem.description}
                          cols={50}
                       onChange={e => setDescription(e.target.value)}/>
            </TableTd>
        </TableTr>
    </>
}

export default QualityFilterItem;
