import React from "react";
import classes from "../species/species.module.css";
import CheckDisabledIcon from "./icons/checkDisabledIcon.tsx";
import CheckedIcon from "./icons/checkedIcon.tsx";
import CheckIcon from "./icons/checkIcon.tsx";

export interface RefineSectionItem {
    label: string | React.ReactElement;
    onClick: () => void;
    isOpen: boolean;
    isDisabled: () => boolean;
}

function refineSection(title: string, items: RefineSectionItem[]): React.ReactElement {
    return (
        <>
            <span className={classes.refineSectionTitle}
                  style={{marginTop: "15px", marginBottom: "10px"}}>{title}</span>
            {items.map((item, idx) => (
                <div key={idx} className="d-flex align-items-start gap-2"
                     style={{cursor: "pointer", marginTop: idx > 0 ? "8px" : "0px"}}
                     onClick={item.onClick}
                >
                    {item.isDisabled() ? <CheckDisabledIcon/> : (item.isOpen ? <CheckedIcon size="16"/> :
                        <CheckIcon size="16"/>)}
                    <span className={classes.refineItem}>{item.label}</span>
                </div>
            ))}
        </>
    );
}

export default refineSection;
