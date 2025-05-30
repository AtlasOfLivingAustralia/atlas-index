/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState, useRef} from 'react';
import styles from './dualRangeSlider.module.css';

interface DoubleRangeSliderProps {
    min: number;
    max: number;
    yearRange: number[];
    stepSize?: number; // for arrow keys
    onChange: (minVal: number, maxVal: number) => void;
    onChangeEnd?: (minVal: number, maxVal: number) => void;
    isDisabled?: boolean;
    singleValue?: boolean;
}

enum DraggedBtn {
    none = -1,
    minBtn = 0,
    maxBtn = 1
}

/**
 * Dual range slider component, with the option of having a single value slider to be used for a consistent UI.
 *
 * @param min minimum value of the range
 * @param max maximum value of the range
 * @param yearRange variable range value. Only one value is used when singleValue is true, otherwise 2 values are used.
 * @param onChange callback function when either value changes
 * @param stepSize step size for arrow keys (default is 1)
 * @param onChangeEnd callback function when the drag ends (optional)
 * @param isDisabled whether the slider is disabled (optional)
 * @param singleValue whether the slider is a single value slider (default is false)
 * @constructor
 */
function DoubleRangeSlider({
                               min,
                               max,
                               yearRange,
                               onChange,
                               stepSize = 1,
                               onChangeEnd,
                               isDisabled,
                               singleValue = false
                           }: DoubleRangeSliderProps) {
    const [dragging, setDragging] = useState<DraggedBtn>(DraggedBtn.none);
    const draggingRef = useRef(dragging);

    const rangeRef = useRef<HTMLDivElement>(null);
    const sliderMin = useRef<HTMLButtonElement>(null);
    const sliderMax = useRef<HTMLButtonElement>(null);
    const rangeSelection = useRef<HTMLDivElement>(null);
    const minValueRef = useRef<number>(null);
    const maxValueRef = useRef<number>(null);

    useEffect(() => {
        if (!yearRange) {
            return;
        }

        setPositions();
        minValueRef.current = yearRange[0];
        maxValueRef.current = yearRange[1];
    }, [yearRange]);

    const handleMouseUp = () => {
        if (draggingRef.current === DraggedBtn.none) return;

        setDragging(DraggedBtn.none);
        if (onChangeEnd && minValueRef.current) {
            onChangeEnd(minValueRef.current, maxValueRef.current ? maxValueRef.current : minValueRef.current);
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (draggingRef.current != DraggedBtn.none && rangeRef.current) {
            const rect = rangeRef.current.getBoundingClientRect();
            const newValue = Number(min) + ((e.clientX - rect.left) / rect.width) * (max - min);
            const thisMinValue = minValueRef.current ? minValueRef.current : yearRange[0];
            const thisMaxValue = maxValueRef.current ? maxValueRef.current : yearRange[1];

            if (draggingRef.current === DraggedBtn.minBtn) {
                onChange(Math.min(Math.max(newValue, min), singleValue ? max : thisMaxValue), thisMaxValue);
            } else {
                onChange(thisMinValue, Math.max(Math.min(newValue, max), thisMinValue));
            }
        }
    };

    useEffect(() => {
        draggingRef.current = dragging;

        if (dragging !== DraggedBtn.none) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging]);

    function setPositions() {
        if (!rangeRef.current || !sliderMin.current) return;

        const minPos = ((yearRange[0] - min) / (max - min)) * 100;
        const maxPos = ((yearRange[1] - min) / (max - min)) * 100;
        if (rangeSelection.current) { // does not exist in single value mode
            rangeSelection.current.style.left = minPos + '%';
            rangeSelection.current.style.right = (100 - maxPos) + '%';
        }

        sliderMin.current.style.left = minPos + '%';

        if (sliderMax.current) {
            sliderMax.current.style.left = maxPos + '%'; // does not exist in single value mode
        }
    }

    const handleMouseDown = (e: any) => {
        // When the buttons have the same value, use the minBtn when the minValue > 50% of the range and
        // the maxBtn when the maxValue < 50% of the range.
        if (singleValue || yearRange[0] !== yearRange[1]) {
            setDragging(e.target == sliderMin.current ? DraggedBtn.minBtn : DraggedBtn.maxBtn);
        } else if (yearRange[0] > (max - min) / 2.0 + min) {
            setDragging(DraggedBtn.minBtn);
        } else {
            setDragging(DraggedBtn.maxBtn);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        let direction = 0; // how far and in which direction to move the slider
        let validKey = true;
        if (e.key === 'ArrowLeft') {
            direction = -1;
        } else if (e.key === 'ArrowRight') {
            direction = 1;
        } else if (e.key === 'PageUp') {
            direction = 10;
        } else if (e.key === 'PageDown') {
            direction = -10;
        } else if (e.key === 'Home') {
            direction = -1 * (max - min);
        } else if (e.key === 'End') {
            direction = max;
        } else {
            validKey = false;
        }
        if (!validKey) return;

        const target = e.target as HTMLElement;
        if (target == sliderMin.current) {
            const newValue = yearRange[0] + direction * stepSize;
            onChange(Math.min(Math.max(newValue, min), singleValue ? max : yearRange[1]), yearRange[1]);
        } else {
            const newValue = yearRange[1] + direction * stepSize;
            onChange(yearRange[0], Math.max(Math.min(newValue, max), yearRange[0]));
        }

        if (onChangeEnd && minValueRef.current) {
            onChangeEnd(minValueRef.current, maxValueRef.current ? maxValueRef.current : minValueRef.current);
        }

        e.preventDefault();
    }

    return (
        <div ref={rangeRef} className={styles.rangeDual + " " + (isDisabled ? " disabled" : "")}>
            <div className={styles.rangeBar}></div>
            {!singleValue &&
                <div ref={rangeSelection} data-testid="rangeSelection" className={styles.rangeSelection}></div>}
            <button ref={sliderMin} role="slider" aria-label="minimum" aria-valuenow={yearRange[0]} aria-valuemin={min}
                    aria-valuemax={max}
                    className={styles.sliderMin + " " + styles.sliderBtn} disabled={isDisabled}
                    onMouseDown={handleMouseDown}
                    onKeyDown={handleKeyDown}></button>
            {!singleValue &&
                <button ref={sliderMax} role="slider" aria-label="maximum" aria-valuenow={yearRange[1]} aria-valuemin={min}
                        aria-valuemax={max} className={styles.sliderMax + " " + styles.sliderBtn} disabled={isDisabled}
                        onMouseDown={handleMouseDown} onKeyDown={handleKeyDown}></button>}
        </div>
    );
}

export default DoubleRangeSlider;
