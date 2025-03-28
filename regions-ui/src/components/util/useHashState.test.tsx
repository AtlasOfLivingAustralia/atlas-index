import {renderHook} from '@testing-library/react';
import {act} from 'react';
import useHashState from './useHashState';

describe('useHashState', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        // Mock window.location and window.addEventListener/removeEventListener
        Object.defineProperty(window, 'location', {
            writable: true,
            value: {
                ...originalLocation,
                hash: '',
            },
        });
        jest.spyOn(window, 'addEventListener');
        jest.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        // Restore original window.location
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation,
        });
        jest.restoreAllMocks();
    });

    it('should return the default value when hash is empty', () => {
        const {result} = renderHook(() => useHashState('test', 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('should return the value from the hash when it exists', () => {
        window.location.hash = '#test=value';
        const {result} = renderHook(() => useHashState('test', 'default'));
        expect(result.current[0]).toBe('value');
    });

    it('should update the hash and state when setHashValue is called', () => {
        const {result} = renderHook(() => useHashState('test', 'default'));
        act(() => {
            result.current[1]('newValue');
        });
        expect(window.location.hash).toBe('#test=newValue');
        expect(result.current[0]).toBe('newValue');
    });

    it('should parse encoded JSON values from the hash', () => {
        window.location.hash = '#test=' + encodeURIComponent('{"key":"value"}');
        const {result} = renderHook(() => useHashState('test', {}));
        expect(result.current[0]).toEqual({key: 'value'});
    });


    it('should stringify and encode JSON values when setHashValue is called with an object', () => {
        const {result} = renderHook(() => useHashState('test', {}));
        act(() => {
            result.current[1]({key: 'newValue'});
        });
        console.log(window.location.hash);
        expect(window.location.hash).toBe('#test=' + encodeURIComponent('{"key":"newValue"}'));
    });

    it('should handle invalid JSON in the hash and return the value as a string', () => {
        window.location.hash = '#test=' + encodeURIComponent('{"invalidJson"');
        const {result} = renderHook(() => useHashState('test', 'default'));
        expect(result.current[0]).toBe('{"invalidJson"');
    });

    it('should remove the hash key when setHashValue is called with undefined', () => {
        window.location.hash = '#test=value';
        const {result} = renderHook(() => useHashState<string | undefined>('test', 'default'));
        act(() => {
            result.current[1](undefined);
        });
        expect(window.location.hash).toBe('#');
    });

    it('should remove the hash key when setHashValue is called with null', () => {
        window.location.hash = '#test=value';
        const {result} = renderHook(() => useHashState<string | null>('test', 'default'));
        act(() => {
            result.current[1](null);
        });
        expect(window.location.hash).toBe('#');
    });

    it('should not update the hash if the new value is the same as the current value', () => {
        window.location.hash = '#test=value';
        const {result} = renderHook(() => useHashState('test', 'default'));
        act(() => {
            result.current[1]('value');
        });
        expect(window.location.hash).toBe('#test=value');
    });

    it('should use the function to update the state if setHashValue is passed a function', () => {
        window.location.hash = '#test=1';
        const {result} = renderHook(() => useHashState<number>('test', 0));
        act(() => {
            // @ts-ignore because it is wanting the first type, "number" from the definition "number | ((prevState: number) => number)"
            result.current[1]((prev: number) => prev + 1);
        });
        expect(window.location.hash).toBe('#test=2');
        expect(result.current[0]).toBe(2);
    });

    it('should add event listener when enableListener is true', () => {
        renderHook(() => useHashState('test', 'default', true));
        expect(window.addEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
    });

    it('should remove event listener when enableListener is true and unmounted', () => {
        const {unmount} = renderHook(() => useHashState('test', 'default', true));
        unmount();
        expect(window.removeEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
    });

    it('should update the state when hash changes and enableListener is true', () => {
        const {result} = renderHook(() => useHashState('test', 'default', true));
        act(() => {
            window.location.hash = '#test=newValue';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(result.current[0]).toBe('newValue');
    });

    it('should not add event listener when enableListener is false', () => {
        renderHook(() => useHashState('test', 'default', false));
        expect(window.addEventListener).not.toHaveBeenCalled();
    });

    it('should delete the key if new value is default value', () => {
        window.location.hash = '#test=value';
        const {result} = renderHook(() => useHashState('test', 'default'));
        act(() => {
            result.current[1]('default');
        });
        expect(window.location.hash).toBe('#');
    });

    it('should be able to modify one hash parameter without changing others', () => {
        window.location.hash = '#another=anotherValue&test=value&other=otherValue';
        const {result} = renderHook(() => useHashState('test', 'default'));
        act(() => {
            result.current[1]('changedValue');
        });

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        expect(hashParams.get('test')).toBe('changedValue');
        expect(hashParams.get('another')).toBe('anotherValue');
        expect(hashParams.get('other')).toBe('otherValue');
    });
});
