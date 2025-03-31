import {render, fireEvent, screen} from '@testing-library/react';
import DualRangeSlider from './dualRangeSlider.tsx';
import '@testing-library/jest-dom';

describe('DualRangeSlider', () => {
    const mockOnChange = jest.fn();
    const mockOnChangeEnd = jest.fn();

    const props = {
        min: 0,
        max: 100,
        minValue: 20,
        maxValue: 80,
        onChange: mockOnChange,
        onChangeEnd: mockOnChangeEnd,
        stepSize: 1,
        isDisabled: false,
        singleValue: false,
    };

    beforeAll(() => {
        // Mock getBoundingClientRect to return specific dimensions
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            width: 100,
            height: 20,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => {
            }
        });
    });

    afterAll(() => {
        // Restore the original implementation
        jest.restoreAllMocks();
    });

    it('displays the 2 buttons, range bar and selection', () => {
        const {container} = render(<DualRangeSlider {...props} />);
        const slider = screen.getAllByRole('slider');
        expect(slider.length == 2)
        expect(container.querySelectorAll('div').length).toBe(3); // 1 parent and 2 child divs
        expect(screen.queryByTestId('rangeSelection')).not.toBeNull();
    });

    it('check min slider mouse drag', () => {
        mockOnChange.mockClear();
        mockOnChangeEnd.mockClear();

        render(<DualRangeSlider {...props} />);

        const minSlider = screen.getAllByRole('slider', {name: 'minimum'});

        // move to the right (starting position is 20)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 50});
        fireEvent.mouseUp(window);
        expect(mockOnChange).toHaveBeenCalled();
        expect(mockOnChangeEnd).toHaveBeenCalled();
        const [minValue1] = mockOnChange.mock.calls[0];
        expect(minValue1).toBe(50); // width is 100, so clientX == value

        // move to the left (starting position is 50)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 10});
        fireEvent.mouseUp(window);
        const [minValue2] = mockOnChange.mock.calls[1]; // 2nd call
        expect(minValue2).toBe(10); // width is 100, so clientX == value

        // move to below 0 (starting position is 10)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: -10});
        fireEvent.mouseUp(window);
        const [minValue3] = mockOnChange.mock.calls[2]; // 3rd call
        expect(minValue3).toBe(0); // width is 100, so clientX == value

        // move to above maxValue (starting position is 0)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 110});
        fireEvent.mouseUp(window);
        const [minValue4] = mockOnChange.mock.calls[3]; // 4th call
        expect(minValue4).toBe(props.maxValue); // width is 100, so clientX == value
    });

    it('check min slider mouse drag when singleValue mode', () => {
        mockOnChange.mockClear();
        mockOnChangeEnd.mockClear();

        const thisProps = {
            ...props,
            singleValue: true,
        };
        render(<DualRangeSlider {...thisProps} />);

        const minSlider = screen.getAllByRole('slider', {name: 'minimum'});

        // move to the right (starting position is 20)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 50});
        fireEvent.mouseUp(window);
        expect(mockOnChange).toHaveBeenCalled();
        expect(mockOnChangeEnd).toHaveBeenCalled();
        const [minValue1] = mockOnChange.mock.calls[0];
        expect(minValue1).toBe(50); // width is 100, so clientX == value

        // move to the left (starting position is 50)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 10});
        fireEvent.mouseUp(window);
        const [minValue2] = mockOnChange.mock.calls[1]; // 2nd call
        expect(minValue2).toBe(10); // width is 100, so clientX == value

        // move to below 0 (starting position is 10)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: -10});
        fireEvent.mouseUp(window);
        const [minValue3] = mockOnChange.mock.calls[2]; // 3rd call
        expect(minValue3).toBe(props.min); // width is 100, so clientX == value

        // move to above max (starting position is 0)
        fireEvent.mouseDown(minSlider[0]);
        fireEvent.mouseMove(window, {clientX: 110});
        fireEvent.mouseUp(window);
        const [minValue4] = mockOnChange.mock.calls[3]; // 4th call
        expect(minValue4).toBe(props.max); // width is 100, so clientX == value
    });

    it('check max slider mouse drag', () => {
        mockOnChange.mockClear();
        mockOnChangeEnd.mockClear();

        render(<DualRangeSlider {...props} />);

        const maxSlider = screen.getAllByRole('slider', {name: 'maximum'});

        // move to the left (starting position is 80)
        fireEvent.mouseDown(maxSlider[0]);
        fireEvent.mouseMove(window, {clientX: 50});
        fireEvent.mouseUp(window);
        expect(mockOnChange).toHaveBeenCalled();
        expect(mockOnChangeEnd).toHaveBeenCalled();
        const changedValues1 = mockOnChange.mock.calls[0];
        expect(changedValues1[1]).toBe(50); // width is 100, so clientX == value

        // move to the right (starting position is 50)
        fireEvent.mouseDown(maxSlider[0]);
        fireEvent.mouseMove(window, {clientX: 90});
        fireEvent.mouseUp(window);
        const changedValues2 = mockOnChange.mock.calls[1]; // 2nd call
        expect(changedValues2[1]).toBe(90); // width is 100, so clientX == value

        // move to below 0 (starting position is 90)
        fireEvent.mouseDown(maxSlider[0]);
        fireEvent.mouseMove(window, {clientX: -10});
        fireEvent.mouseUp(window);
        const changedValues3 = mockOnChange.mock.calls[2]; // 3rd call
        expect(changedValues3[1]).toBe(props.minValue); // width is 100, so clientX == value

        // move to above max (starting position is 20)
        fireEvent.mouseDown(maxSlider[0]);
        fireEvent.mouseMove(window, {clientX: 110});
        fireEvent.mouseUp(window);
        const changedValues4 = mockOnChange.mock.calls[3]; // 4th call
        expect(changedValues4[1]).toBe(props.max); // width is 100, so clientX == value
    });

    it('check max slider key events', () => {
        mockOnChange.mockClear();
        mockOnChangeEnd.mockClear();

        const {rerender} = render(<DualRangeSlider {...props} />);

        const maxSlider = screen.getAllByRole('slider', {name: 'maximum'});

        // move to the right (starting position is 80)
        fireEvent.keyDown(maxSlider[0], {key: 'ArrowRight'});
        expect(mockOnChange).toHaveBeenCalled();
        expect(mockOnChangeEnd).toHaveBeenCalled();
        const changedValues1 = mockOnChange.mock.calls[0];
        expect(changedValues1[1]).toBe(81);

        // move to the left (starting position is 81)
        var thisProps = {...props, maxValue: 81};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'ArrowLeft'});
        const changedValues2 = mockOnChange.mock.calls[1]; // 2nd call
        expect(changedValues2[1]).toBe(80);

        // move to by page to the right (starting position is 80)
        thisProps = {...props, maxValue: 80};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'PageUp'});
        const changedValues3 = mockOnChange.mock.calls[2]; // 3rd call
        expect(changedValues3[1]).toBe(90);

        // move by page to the left (starting position is 90)
        thisProps = {...props, maxValue: 90};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'PageDown'});
        const changedValues4 = mockOnChange.mock.calls[3]; // 4th call
        expect(changedValues4[1]).toBe(80);

        // move to end (starting position is 80)
        thisProps = {...props, maxValue: 80};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'End'});
        const changedValues5 = mockOnChange.mock.calls[4]; // 5th call
        expect(changedValues5[1]).toBe(props.max);

        // move to home, below starting position (starting position is 100)
        thisProps = {...props, maxValue: 100};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'Home'});
        const changedValues6 = mockOnChange.mock.calls[5]; // 6th call
        expect(changedValues6[1]).toBe(props.minValue);

        // move to above max (starting position is 100)
        thisProps = {...props, maxValue: 100};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(maxSlider[0], {key: 'ArrowRight'});
        const changedValues7 = mockOnChange.mock.calls[6]; // 7th call
        expect(changedValues7[1]).toBe(props.max);
    });

    it('check min slider key events', () => {
        mockOnChange.mockClear();
        mockOnChangeEnd.mockClear();

        const {rerender} = render(<DualRangeSlider {...props} />);

        const minSlider = screen.getAllByRole('slider', {name: 'minimum'});

        // move to the right (starting position is 20)
        fireEvent.keyDown(minSlider[0], {key: 'ArrowRight'});
        expect(mockOnChange).toHaveBeenCalled();
        expect(mockOnChangeEnd).toHaveBeenCalled();
        const changedValues1 = mockOnChange.mock.calls[0];
        expect(changedValues1[0]).toBe(21);

        // move to the left (starting position is 21)
        var thisProps = {...props, minValue: 21};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'ArrowLeft'});
        const changedValues2 = mockOnChange.mock.calls[1]; // 2nd call
        expect(changedValues2[0]).toBe(20);

        // move to by page to the right (starting position is 20)
        thisProps = {...props, minValue: 20};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'PageUp'});
        const changedValues3 = mockOnChange.mock.calls[2]; // 3rd call
        expect(changedValues3[0]).toBe(30);

        // move by page to the left (starting position is 30)
        thisProps = {...props, minValue: 30};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'PageDown'});
        const changedValues4 = mockOnChange.mock.calls[3]; // 4th call
        expect(changedValues4[0]).toBe(20);

        // move to end, above maxValue (starting position is 20)
        thisProps = {...props, minValue: 20};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'End'});
        const changedValues5 = mockOnChange.mock.calls[4]; // 5th call
        expect(changedValues5[0]).toBe(props.maxValue);

        // move to home (starting position is 50)
        thisProps = {...props, minValue: 50};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'Home'});
        const changedValues6 = mockOnChange.mock.calls[5]; // 6th call
        expect(changedValues6[0]).toBe(props.min);

        // move to below min (starting position is 0)
        thisProps = {...props, minValue: 0};
        rerender(<DualRangeSlider {...thisProps} />);
        fireEvent.keyDown(minSlider[0], {key: 'ArrowLeft'});
        const changedValues7 = mockOnChange.mock.calls[6]; // 7th call
        expect(changedValues7[0]).toBe(props.min);
    });

    it('disables sliders when isDisabled is true', () => {
        const {getByRole} = render(<DualRangeSlider {...{...props, isDisabled: true}} />);
        expect(getByRole('slider', {name: 'maximum'})).toBeDisabled();
        expect(getByRole('slider', {name: 'minimum'})).toBeDisabled();
    });

    it('renders single value slider when singleValue is true', () => {
        render(<DualRangeSlider {...{...props, singleValue: true}} />);
        expect(screen.queryByTestId('rangeSelection')).toBeNull();
        expect(screen.queryAllByRole('slider', {name: 'maximum'}).length).toBe(0);
    });
});

