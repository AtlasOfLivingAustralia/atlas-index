import React, { useEffect, useState, useRef } from 'react';
import "./dualRangeSlider.css"

interface DoubleRangeSliderProps {
    min: number;
    max: number;
    minValue: number;
    maxValue: number;
    stepSize?: number; // for arrow keys
    onChange: (minVal: number, maxVal: number) => void;
    onChangeEnd?: () => void;
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
 * @param minValue current (variable) minimum value (or single value)
 * @param maxValue current (variable) maximum value (when singleValue is false)
 * @param onChange callback function when either value changes
 * @param stepSize step size for arrow keys (default is 1)
 * @param onChangeEnd callback function when the drag ends (optional)
 * @param isDisabled whether the slider is disabled (optional)
 * @param singleValue whether the slider is a single value slider (default is false)
 * @constructor
 */
function DoubleRangeSlider({ min, max, minValue, maxValue, onChange, stepSize = 1, onChangeEnd, isDisabled, singleValue = false}: DoubleRangeSliderProps) {
    const [dragging, setDragging] = useState<DraggedBtn>(DraggedBtn.none);

    const rangeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPositions();
    }, [minValue, maxValue]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragging != DraggedBtn.none && rangeRef.current) {
                const rect = rangeRef.current.getBoundingClientRect();
                const newValue = Number(min) + ((e.clientX - rect.left) / rect.width) * (max - min);

                if (dragging === DraggedBtn.minBtn) {
                    onChange(Math.min(Math.max(newValue, min), maxValue), maxValue);
                } else {
                    onChange(minValue, Math.max(Math.min(newValue, max), minValue));
                }
            }
        };

        const handleMouseUp = () => {
            if (dragging === DraggedBtn.none) return;

            setDragging(DraggedBtn.none);
            if (onChangeEnd) {
                onChangeEnd();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, min, max, minValue, maxValue, onChange]);

    function setPositions() {
        if (!rangeRef.current) return;

        const minPos = ((minValue - min) / (max - min)) * 100;
        const maxPos = ((maxValue - min) / (max - min)) * 100;
        const rangeSelection = rangeRef.current.querySelector('.rangeSelection') as HTMLDivElement;
        if (rangeSelection) { // does not exist in single value mode
            rangeSelection.style.left = minPos + '%';
            rangeSelection.style.right = (100 - maxPos) + '%';
        }

        const sliderMin = rangeRef.current.querySelector('.sliderMin') as HTMLButtonElement;
        sliderMin.style.left = minPos + '%';
        const sliderMax = rangeRef.current.querySelector('.sliderMax') as HTMLButtonElement;
        if (sliderMax) {
            sliderMax.style.left = maxPos + '%'; // does not exist in single value mode
        }
    }

    const handleMouseDown = (e: any) => {
        setDragging(e.target.classList.contains('sliderMin') ? DraggedBtn.minBtn : DraggedBtn.maxBtn);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        let direction = 0;
        if (e.key === 'ArrowLeft') {
            direction = -1;
        } else if (e.key === 'ArrowRight') {
            direction = 1;
        }
        if (direction === 0) return;

        const target = e.target as HTMLElement;
        if (target.classList.contains('sliderMin')) {
            onChange(Math.max(min, minValue + direction * stepSize), maxValue);
        } else {
            onChange(minValue, Math.max(minValue, maxValue + direction *  stepSize));
        }

        if (onChangeEnd) {
            onChangeEnd();
        }

        e.preventDefault();
    }

    return (
        <div ref={rangeRef} className={"rangeDual" + (isDisabled ? " disabled" : "")}>
            <div className="rangeBar"></div>
            { !singleValue && <div className="rangeSelection"></div> }
            <button className="sliderMin sliderBtn" disabled={isDisabled} onMouseDown={handleMouseDown} onKeyDown={handleKeyDown}></button>
            { !singleValue && <button className="sliderMax sliderBtn" disabled={isDisabled} onMouseDown={handleMouseDown} onKeyDown={handleKeyDown}></button> }
        </div>
    );
}

export default DoubleRangeSlider;
