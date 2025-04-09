import {QualityCategory, QualityFilter} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import QualityFilterItem from "./qualityFilterItem.tsx";
import {Table, TableTd, TableTr, TableTbody, Button, Textarea} from "@mantine/core";

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
        <Table className="table table-sm table-bordered">
            <TableTbody>
            <TableTr>
                <TableTd colSpan={2}>
                    <input type="checkbox" checked={category.enabled}
                           onChange={() => setEnabled(!category.enabled)}></input> ({category.id})
                    <Textarea value={category.name}
                              rows={3}
                              cols={50}
                              onChange={e => setName(e.target.value)}/>
                    <Button className="btn border-black ms-1" onClick={() => {props.deleteCategory(category)}}>Delete</Button>
                </TableTd>
            </TableTr>
            <TableTr>
                <TableTd>Description</TableTd>
                <TableTd>
                    <Textarea value={category.description}
                              rows={3}
                              cols={50}
                              onChange={e => setDescription(e.target.value)}></Textarea>
                </TableTd>
            </TableTr>
            <TableTr>
                <TableTd>Inverse filter</TableTd>
                <TableTd>
                    <Textarea value={category.inverseFilter}
                              rows={3}
                              cols={50}
                              onChange={e => setInverseFilter(e.target.value)}/>
                </TableTd>
            </TableTr>
            <TableTr>
                <TableTd colSpan={2}>
                    <Button className="btn border-black ms-1"
                            onClick={() => addFilter(category)}>Add
                        filter
                    </Button>
                </TableTd>
            </TableTr>
            <TableTr>
                <TableTd colSpan={2}>
                    <Table className="table table-sm table-bordered">
                        <TableTbody>
                        {category.qualityFilters.map((filter, idx) =>
                                <QualityFilterItem key={idx} filter={filter}
                                                          parentFilter={props.parentCategory ? props.parentCategory.qualityFilters.find(it => it.displayOrder == filter.displayOrder) : undefined}
                                                          setProfileDirty={props.setProfileDirty}
                                                          resetInverseFilter={resetInverseFilter}/>
                        )}
                        </TableTbody>
                    </Table>
                </TableTd>
            </TableTr>
            </TableTbody>
        </Table>
    </>
}

export default QualityCategoryItem;
