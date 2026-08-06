/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {renderHook} from '@testing-library/react';
import {useHeight} from './useHeight.tsx';

describe('useHeight', () => {
    let observeMock: jest.Mock;
    let unobserveMock: jest.Mock;
    let resizeCallback: (entries: any[]) => void;

    beforeEach(() => {
        observeMock = jest.fn();
        unobserveMock = jest.fn();
        (global as any).ResizeObserver = jest.fn().mockImplementation((cb: (entries: any[]) => void) => {
            resizeCallback = cb;
            return {
                observe: observeMock,
                unobserve: unobserveMock,
                disconnect: jest.fn(),
            };
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns 0 when there is no ref element', () => {
        const ref = {current: null};
        const {result} = renderHook(() => useHeight(ref));
        expect(result.current).toBe(0);
    });

    it('returns the scrollHeight of the ref element on mount', () => {
        const element = {scrollHeight: 123};
        const ref = {current: element};
        const {result} = renderHook(() => useHeight(ref));
        expect(result.current).toBe(123);
    });

    it('observes the ref element with a ResizeObserver', () => {
        const element = {scrollHeight: 50};
        const ref = {current: element};
        renderHook(() => useHeight(ref));
        expect(observeMock).toHaveBeenCalledWith(element);
    });

    it('updates the height when the ResizeObserver reports a new height', () => {
        const element = {scrollHeight: 50};
        const ref = {current: element};
        const {result} = renderHook(() => useHeight(ref));

        const {act} = require('react');
        act(() => {
            resizeCallback([{contentRect: {height: 200}}]);
        });

        expect(result.current).toBe(200);
    });

    it('unobserves the element on unmount', () => {
        const element = {scrollHeight: 50};
        const ref = {current: element};
        const {unmount} = renderHook(() => useHeight(ref));
        unmount();
        expect(unobserveMock).toHaveBeenCalledWith(element);
    });
});
