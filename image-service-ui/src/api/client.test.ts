/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {apiDelete, apiGet, apiPost, ApiError, setApiAccessToken} from './client';

describe('apiRequest', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        setApiAccessToken(undefined);
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('attaches the current ALA access token as a bearer credential', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ok: true, status: 204, headers: new Headers()});
        global.fetch = fetchMock as unknown as typeof fetch;
        setApiAccessToken('access-token-123');

        await apiPost('http://api.test', '/ws/uploadImage');

        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer access-token-123');
    });

    it('resolves with parsed JSON on success and always sends credentials: include', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => ({hello: 'world'})
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await apiGet<{ hello: string }>('http://api.test', '/api/v2/foo');

        expect(result).toEqual({hello: 'world'});
        expect(fetchMock).toHaveBeenCalledWith(
            'http://api.test/api/v2/foo',
            expect.objectContaining({credentials: 'include', method: 'GET'})
        );
    });

    it('serializes query params, including array values as repeated keys', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => ({})
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await apiGet('http://api.test', '/api/v2/search', {q: 'banksia', fq: ['a:1', 'b:2']});

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain('q=banksia');
        expect(calledUrl).toContain('fq=a%3A1');
        expect(calledUrl).toContain('fq=b%3A2');
    });

    it('rejects with a structured ApiError parsed from the {error:{message,code}} contract shape', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => ({error: {message: 'You do not own this image', code: 'FORBIDDEN_NOT_OWNER'}})
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(apiDelete('http://api.test', '/api/v2/images/img-1')).rejects.toMatchObject({
            status: 403,
            message: 'You do not own this image',
            code: 'FORBIDDEN_NOT_OWNER'
        });
    });

    it('marks 401/403 responses as isUnauthorized', async () => {
        const err = new ApiError(401, 'nope');
        expect(err.isUnauthorized).toBe(true);
        expect(new ApiError(404, 'nope').isUnauthorized).toBe(false);
    });

    it('wraps network failures in an ApiError with status 0', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;

        await expect(apiGet('http://api.test', '/api/v2/foo')).rejects.toMatchObject({status: 0});
    });

    it('gives an actionable message (mentioning CORS and the backend URL) for a rejected fetch, instead of just relaying the opaque browser message', async () => {
        // "Load failed" (Safari) / "Failed to fetch" (Chrome/Firefox) are the generic messages
        // browsers give for a fetch() that never reached the app layer — most commonly a CORS/
        // preflight rejection. See client.ts's apiRequest catch block for the reasoning.
        global.fetch = jest.fn().mockRejectedValue(new Error('Load failed')) as unknown as typeof fetch;

        await expect(apiGet('http://api.test', '/api/v2/uploads')).rejects.toMatchObject({
            status: 0,
            code: 'NETWORK_ERROR',
            message: expect.stringContaining('CORS')
        });
        await expect(apiGet('http://api.test', '/api/v2/uploads')).rejects.toMatchObject({
            message: expect.stringContaining('http://api.test')
        });
    });

    it('sends a JSON body and Content-Type header for POST requests', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 204,
            headers: new Headers(),
            json: async () => ({})
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await apiPost('http://api.test', '/api/v2/images/img-1/tags/tag-1', {});

        const options = fetchMock.mock.calls[0][1];
        expect(options.headers['Content-Type']).toBe('application/json');
    });

    describe('CSRF token handling', () => {
        const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

        function setCookie(value: string) {
            Object.defineProperty(document, 'cookie', {configurable: true, get: () => value, set: () => {}});
        }

        afterEach(() => {
            if (originalCookie) Object.defineProperty(Document.prototype, 'cookie', originalCookie);
        });

        it('echoes the XSRF-TOKEN cookie back as an X-XSRF-TOKEN header on state-changing requests', async () => {
            setCookie('other=1; XSRF-TOKEN=abc123; more=2');
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 204,
                headers: new Headers(),
                json: async () => ({})
            });
            global.fetch = fetchMock as unknown as typeof fetch;

            await apiPost('http://api.test', '/api/v2/images/img-1/tags/tag-1');

            const options = fetchMock.mock.calls[0][1];
            expect(options.headers['X-XSRF-TOKEN']).toBe('abc123');
        });

        it('does not add an X-XSRF-TOKEN header for GET requests', async () => {
            setCookie('XSRF-TOKEN=abc123');
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({'content-type': 'application/json'}),
                json: async () => ({})
            });
            global.fetch = fetchMock as unknown as typeof fetch;

            await apiGet('http://api.test', '/api/v2/session');

            const options = fetchMock.mock.calls[0][1];
            expect(options.headers['X-XSRF-TOKEN']).toBeUndefined();
        });

        it('omits the header when no XSRF-TOKEN cookie is present', async () => {
            setCookie('');
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 204,
                headers: new Headers(),
                json: async () => ({})
            });
            global.fetch = fetchMock as unknown as typeof fetch;

            await apiPost('http://api.test', '/api/v2/images/img-1/tags/tag-1');

            const options = fetchMock.mock.calls[0][1];
            expect(options.headers['X-XSRF-TOKEN']).toBeUndefined();
        });
    });
});
