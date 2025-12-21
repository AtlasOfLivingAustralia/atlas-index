import {faCaretDown, faCaretUp} from "@fortawesome/free-solid-svg-icons";
import React, {useState} from "react";
import {FontAwesomeIconLite} from "../index.ts";
import classes from "./refineSection.module.css";
import CheckDisabledIcon from "../icons/checkDisabledIcon.tsx";
import CheckedIcon from "../icons/checkedIcon.tsx";
import CheckIcon from "../icons/checkIcon.tsx";

export interface RefineSectionItem {
    label: string | React.ReactElement;
    onClick: () => void;
    isOpen: boolean;
    isDisabled: () => boolean;
}

interface RefineSectionProps {
    title: string;
    items: RefineSectionItem[];
    lessNumber?: number;
}

function RefineSection({ title, items, lessNumber }: RefineSectionProps) {
    const [more, setMore] = useState(false);

    const thisLessNumber = lessNumber || Number.MAX_VALUE;

    return <>
        <span className={classes.refineSectionTitle}
              style={{marginTop: "15px", marginBottom: "10px"}}>{title}</span>
        {items.map((item, idx) =>
            thisLessNumber <= idx && !more ? null :
                <div key={idx} className="d-flex align-items-start gap-2"
                     style={{cursor: "pointer", marginTop: idx > 0 ? "8px" : "0px"}}
                     onClick={item.onClick}>
                    {item.isDisabled() ? <CheckDisabledIcon/> :
                        (item.isOpen ? <CheckedIcon size="16"/> : <CheckIcon size="16"/>)}
                    <span className={classes.refineItem}>{item.label}</span>
                </div>
        )}
        {thisLessNumber && items.length > thisLessNumber && (
            more ?
                <div onClick={() => {setMore(false)}} style={{marginTop: '8px', color: '#c44d34', cursor: 'pointer'}}>
                    <FontAwesomeIconLite icon={faCaretUp} size="14" style={{marginRight: '8px'}}/>
                    <span className={classes.refineItem}>
                                        Show less
                                    </span>
                </div>
                :
                <div onClick={() => {setMore(true)}} style={{marginTop: '8px', color: '#c44d34', cursor: 'pointer'}}>
                    <FontAwesomeIconLite icon={faCaretDown} size="14" style={{marginRight: '8px'}}/>
                    <span className={classes.refineItem}>
                                        Show more
                                    </span>
                </div>
        )}
    </>;
}

export default RefineSection;
