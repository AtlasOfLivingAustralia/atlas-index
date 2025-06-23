import {QualityCategory, QualityFilter} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import QualityFilterItem from "./qualityFilterItem.tsx";

function QualityCategoryItem(props: {
    category: QualityCategory,
    parentCategory: QualityCategory | undefined,
    setProfileDirty: (dirty: boolean) => void,
    saveCategory?: (category: QualityCategory) => void,
    saveFilter?: (category: QualityFilter) => void,
    deleteCategory: (category: QualityCategory) => void
}) {
    const [category, setCategory] = useState<QualityCategory>(props.category);

    useEffect(() => {
        setCategory(props.category);
    }, [props.category]);

    function addFilter(category: any) {
        let filter : QualityFilter = {
            id: 0,
            enabled: true,
            filter: "enter a new filter",
            inverseFilter: '',
            description: '',
            displayOrder: category.qualityFilters.length
        };

        category.qualityFilters.push(filter);
        setCategory({...category});

        // update parent not required, parent is already updated, because qualityFilters is a reference
        // if (props.parentCategory) {
        //     props.parentCategory.qualityFilters.push(filter);
        // }
    }

    function setEnabled(enabled: boolean) {
        // update display
        category.enabled = enabled;
        setCategory({...category});

        // update parent
        if (props.parentCategory) {
            props.parentCategory.enabled = enabled;
            props.setProfileDirty(true);
        }
    }

    function setName(name: string) {
        // update display
        category.name = name;
        setCategory({...category});

        // update parent
        if (props.parentCategory) {
            props.parentCategory.name = name;
            props.setProfileDirty(true);
        }
    }

    function setDescription(description: string) {
        // update display
        category.description = description;
        setCategory({...category});

        // update parent
        if (props.parentCategory) {
            props.parentCategory.description = description;
            props.setProfileDirty(true);
        }
    }

    function setInverseFilter(inverseFilter: string) {
        // update display
        category.inverseFilter = inverseFilter;
        setCategory({...category});

        // update parent
        if (props.parentCategory) {
            props.parentCategory.inverseFilter = inverseFilter;
            props.setProfileDirty(true);
        }
    }

    function resetInverseFilter() {
        // update display
        category.inverseFilter = '';
        setCategory({...category});

        // update parent
        if (props.parentCategory) {
            props.parentCategory.inverseFilter = '';
            props.setProfileDirty(true);
        }
    }

    return <>
        <table className="table table-sm table-bordered">
            <tbody>
            <tr>
                <td colSpan={2}>
                    <input type="checkbox" checked={category.enabled}
                           onChange={() => setEnabled(!category.enabled)}></input> ({category.id})
                    <input type="text" value={category.name}
                           className="w-50 ms-3"
                           onChange={e => setName(e.target.value)}/>
                    <button className="btn border-black ms-1" onClick={() => {props.deleteCategory(category)}}>Delete</button>
                </td>
            </tr>
            <tr>
                <td>Description</td>
                <td>
                    <textarea value={category.description}
                              rows={3}
                              cols={50}
                              onChange={e => setDescription(e.target.value)}></textarea>
                </td>
            </tr>
            <tr>
                <td>Inverse filter</td>
                <td>
                    <input type="text" value={category.inverseFilter}
                           className="w-100"
                           onChange={e => setInverseFilter(e.target.value)}/>
                </td>
            </tr>
            <tr>
                <td colSpan={2}>
                    <button className="btn border-black ms-1"
                            onClick={() => addFilter(category)}>Add
                        filter
                    </button>
                </td>
            </tr>
            <tr>
                <td colSpan={2}>
                    <table className="table table-sm table-bordered">
                        <tbody>
                        {category.qualityFilters.map((filter, idx) =>
                                <QualityFilterItem key={idx} filter={filter}
                                                          parentFilter={props.parentCategory ? props.parentCategory.qualityFilters.find(it => it.displayOrder == filter.displayOrder) : undefined}
                                                          setProfileDirty={props.setProfileDirty}
                                                          resetInverseFilter={resetInverseFilter}/>
                        )}
                        </tbody>
                    </table>
                </td>
            </tr>
            </tbody>
        </table>
    </>
}

export default QualityCategoryItem;
