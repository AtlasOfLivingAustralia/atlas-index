/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Thin typed fetch client for the image-service `/api/v2` structured JSON
 * API. All requests are made with `credentials: 'include'` so the
 * backend-brokered session cookie is sent — the frontend never stores or
 * attaches an access/API key itself (see AuthContext / doi-ui pattern).
 *
 * Callers get a discriminated result so they can render loading / empty /
 * unauthorized / failure states without the client silently swallowing
 * errors or fabricating data.
 */

export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly body?: unknown;

    constructor(status: number, message: string, code?: string, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.body = body;
    }

    get isUnauthorized(): boolean {
        return this.status === 401 || this.status === 403;
    }
}

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null | string[]>;
    signal?: AbortSignal;
    /** Set when the body is FormData and must not be JSON-stringified/have Content-Type set. */
    isFormData?: boolean;
}

function buildQueryString(query?: RequestOptions['query']): string {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            for (const v of value) params.append(key, v);
        } else {
            params.append(key, String(value));
        }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

/**
 * Reads a cookie value by name from `document.cookie`. Used to read the
 * `XSRF-TOKEN` cookie the backend issues on first contact (e.g. the
 * `/api/v2/session` call) so it can be echoed back as the `X-XSRF-TOKEN`
 * header on state-changing requests, per the backend's CSRF contract.
 */
function readCookie(name: string): string | undefined {
    if (typeof document === 'undefined' || !document.cookie) return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
}

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Whether Vite should proxy a development request to a different API origin. */
export function usesDevelopmentProxy(baseUrl: string): boolean {
    const explicitlyLocalBackend = /^https?:\/\/(localhost|127\.0\.0\.1):8080\/?$/i.test(baseUrl);
    if ((!import.meta.env.DEV && !explicitlyLocalBackend) || typeof window === 'undefined') return false;
    try {
        return new URL(baseUrl, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}

/**
 * Extracts a human-readable message from a failed JSON error response.
 * The backend's confirmed error contract is `{ error: { message, code } }`
 * on every non-2xx response; older/unexpected shapes are tolerated as a
 * fallback so a malformed error body doesn't itself throw.
 */
async function parseErrorBody(response: Response): Promise<{ message: string; code?: string; body?: unknown }> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        try {
            const body = await response.json();
            const message = body?.error?.message ?? body?.message ?? response.statusText ?? 'Request failed';
            const code = body?.error?.code;
            return {message, code, body};
        } catch {
            // fall through
        }
    }
    try {
        const text = await response.text();
        return {message: text || response.statusText || 'Request failed'};
    } catch {
        return {message: response.statusText || 'Request failed'};
    }
}

/**
 * Performs a request against `${baseUrl}${path}`, resolving with the parsed
 * JSON body on success and rejecting with an {@link ApiError} on any
 * non-2xx response or network failure. `AbortSignal` is passed straight
 * through to `fetch`.
 *
 * State-changing requests (anything but GET/HEAD/OPTIONS) automatically
 * echo the `XSRF-TOKEN` cookie back as an `X-XSRF-TOKEN` header, since a
 * plain `fetch()` does not do this on its own and the backend requires it.
 */
export async function apiRequest<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
    const {method = 'GET', body, query, signal, isFormData} = options;
    // The legacy image-service does not consistently add CORS headers to its
    // public endpoints. During local Vite development, send API reads/writes
    // through the existing dev-server proxy instead of requiring backend
    // changes. Production and non-local API URLs remain untouched.
    const requestBaseUrl = usesDevelopmentProxy(baseUrl) ? '/image-service' : baseUrl;
    const url = `${requestBaseUrl}${path}${buildQueryString(query)}`;

    const headers: Record<string, string> = {};
    let requestBody: BodyInit | undefined;
    if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    } else if (isFormData) {
        requestBody = body as BodyInit;
    }

    if (!SAFE_METHODS.has(method)) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME);
        if (csrfToken) {
            headers[CSRF_HEADER_NAME] = csrfToken;
        }
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            credentials: 'include',
            headers,
            body: requestBody,
            signal
        });
    } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        // A rejected fetch() (as opposed to a resolved non-2xx response, handled below)
        // means the request never reached the application layer at all. In practice this
        // is overwhelmingly caused by the browser blocking the request/response outright —
        // most often a CORS/preflight rejection (e.g. the backend's
        // Access-Control-Allow-Headers not yet including X-XSRF-TOKEN for this route), a
        // backend that isn't reachable at VITE_APP_API_URL, or mixed-content blocking.
        // Browsers report all of these as an opaque one-line message ("Failed to fetch" in
        // Chrome/Firefox, "Load failed" in Safari) with no further detail, so surface that
        // context explicitly rather than just relaying the raw browser message.
        const browserMessage = (err as Error).message;
        throw new ApiError(
            0,
            `Could not reach ${path} (${browserMessage}). This is usually a CORS/preflight rejection or an ` +
                `unreachable backend at ${baseUrl} — check the browser console's network tab for the specific ` +
                'CORS error, and confirm VITE_APP_API_URL and the backend\'s CORS configuration.',
            'NETWORK_ERROR'
        );
    }

    if (!response.ok) {
        const {message, code, body: errBody} = await parseErrorBody(response);
        throw new ApiError(response.status, message, code, errBody);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
}

export function apiGet<T>(baseUrl: string, path: string, query?: RequestOptions['query'], signal?: AbortSignal): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'GET', query, signal});
}

export function apiPost<T>(baseUrl: string, path: string, body?: unknown, signal?: AbortSignal, query?: RequestOptions['query']): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'POST', body, signal, query});
}

export function apiPut<T>(baseUrl: string, path: string, body?: unknown, signal?: AbortSignal, query?: RequestOptions['query']): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'PUT', body, signal, query});
}

export function apiPatch<T>(baseUrl: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'PATCH', body, signal});
}

export function apiDelete<T>(baseUrl: string, path: string, signal?: AbortSignal, query?: RequestOptions['query']): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'DELETE', signal, query});
}

export function apiPostForm<T>(baseUrl: string, path: string, formData: FormData, signal?: AbortSignal, query?: RequestOptions['query']): Promise<T> {
    return apiRequest<T>(baseUrl, path, {method: 'POST', body: formData, isFormData: true, signal, query});
}

/** Builds an absolute download/zip URL (browser navigation, not fetch) that still relies on the session cookie. */
export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
    return `${baseUrl}${path}${buildQueryString(query)}`;
}
