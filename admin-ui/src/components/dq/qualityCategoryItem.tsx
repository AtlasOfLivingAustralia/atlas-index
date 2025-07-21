import {QualityCategory, QualityFilter} from '../../api/sources/model.ts';
import {useEffect, useState} from 'react';
import QualityFilterItem from './qualityFilterItem.tsx';
import classes from './quality.module.css';

function QualityCategoryItem(props: {
    category: QualityCategory; // clone of the category to avoid modifying the original object directly
    actualCategory: QualityCategory | undefined; // actual category to update when changes are made
    setProfileDirty: (dirty: boolean) => void;
    saveCategory?: (category: QualityCategory) => void;
    saveFilter?: (category: QualityFilter) => void;
    deleteCategory: (category: QualityCategory) => void;
}) {
    const [category, setCategory] = useState<QualityCategory>(props.category);

    useEffect(() => {
        setCategory(props.category);
    }, [props.category]);

    function addFilter(category: any) {
        let filter: QualityFilter = {
            id: 0,
            enabled: true,
            filter: 'enter a new filter',
            inverseFilter: '',
            description: '',
            displayOrder: category.qualityFilters.length,
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
        if (props.actualCategory) {
            props.actualCategory.enabled = enabled;
            props.setProfileDirty(true);
        }
    }

    function setName(name: string) {
        // update display
        category.name = name;
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.name = name;
            props.setProfileDirty(true);
        }
    }

    function setLabel(label: string) {
        // update display
        category.label = label;
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.label = label;
            props.setProfileDirty(true);
        }
    }

    function setDescription(description: string) {
        // update display
        category.description = description;
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.description = description;
            props.setProfileDirty(true);
        }
    }

    function setInverseFilter(inverseFilter: string) {
        // update display
        category.inverseFilter = inverseFilter;
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.inverseFilter = inverseFilter;
            props.setProfileDirty(true);
        }
    }

    function resetInverseFilter() {
        // update display
        category.inverseFilter = '';
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.inverseFilter = '';
            props.setProfileDirty(true);
        }
    }

    function deleteFilterItem(id: number) {
        // update display
        category.qualityFilters = category.qualityFilters.filter(
            (f) => f.id !== id
        );
        setCategory({...category});

        // update parent
        if (props.actualCategory) {
            props.actualCategory.qualityFilters = props.actualCategory.qualityFilters.filter(
                (f) => f.id !== id
            );
            props.setProfileDirty(true);
        }
    }

    return (
        <div className={"border-2 shadow " + classes.itemBg}>
            <table className={"table table-sm table-borderless"}>
                <tbody>
                <tr>
                    <td colSpan={2} style={{backgroundColor: '#e9e9e9'}}>
                        <div className={"d-flex align-items-center"}>
                            <input
                                type="checkbox"
                                checked={category.enabled}
                                onChange={() => setEnabled(!category.enabled)}
                                className={"ms-2 me-1"}
                            ></input>{' '}
                            (id: {category.id})
                            <div className={"ms-3"}>
                            label:
                            <input
                                type="text"
                                value={category.label}
                                className="ms-3 fw-bold rounded-2"
                                onChange={(e) => setLabel(e.target.value)}
                            />
                            </div>
                            <div className={"ms-3"}>
                            name:
                            <input
                                type="text"
                                value={category.name}
                                className="ms-3 fw-bold rounded-2"
                                onChange={(e) => setName(e.target.value)}
                                style={{width:'500px'}}
                            />
                            </div>
                            <button
                                className="btn border-black btn-danger ms-auto"
                                onClick={() => {
                                    props.deleteCategory(category);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td className={"ps-3 fw-bold pt-3"}>Description</td>
                    <td>
                            <textarea className={"mt-3"}
                                value={category.description}
                                rows={3}
                                cols={50}
                                onChange={(e) => setDescription(e.target.value)}
                            ></textarea>
                    </td>
                </tr>
                <tr>
                    <td className={"ps-3 w-25 fw-bold"}>Inverse filter (manual override when API incorrect)</td>
                    <td>
                        { category.qualityFilters && category.qualityFilters.find(f => f.filter.includes('(')) &&
                            <span className={"text-danger"}>
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                This category contains filters with parentheses, which may cause issues with inverse filtering.
                                Set the inverse filter manually.
                            </span>
                        }
                        <input
                            type="text"
                            value={category.inverseFilter}
                            className="w-100"
                            onChange={(e) =>
                                setInverseFilter(e.target.value)
                            }
                        />
                    </td>
                </tr>
                <tr>
                    <td className={"ps-3"} colSpan={2}>
                        <hr/>
                        <h4 className={"mt-2 mb-2"}>Filters</h4>
                        <table className="table table-sm table-borderless">
                            <thead>
                            <tr>
                                <th>enabled</th>
                                <th>filter</th>
                                <th>inverse filter (manual override when API incorrect)</th>
                                <th>description</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {category.qualityFilters && category.qualityFilters.slice().sort((a, b) => a.id - b.id).map(
                                (filter, idx) => (
                                    <QualityFilterItem
                                        key={idx}
                                        filter={filter}
                                        actualFilter={
                                            props.actualCategory?.qualityFilters
                                                ? props.actualCategory.qualityFilters.find(
                                                    (it) =>
                                                        it.displayOrder ==
                                                        filter.displayOrder
                                                )
                                                : undefined
                                        }
                                        setProfileDirty={
                                            props.setProfileDirty
                                        }
                                        resetInverseFilter={
                                            resetInverseFilter
                                        }
                                        deleteFilterItem={
                                            deleteFilterItem
                                        }
                                    />
                                )
                            )}

                            <tr>
                                <td colSpan={2}>
                                    <button
                                        className="btn border-black ms-1"
                                        onClick={() => addFilter(category)}
                                    >
                                        Add filter
                                    </button>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
    );
}

export default QualityCategoryItem;
