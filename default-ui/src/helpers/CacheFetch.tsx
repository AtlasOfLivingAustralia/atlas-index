const CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours

interface CachedItem {
    time: number,
    data: any
}

/**
 * Cache fetch JSON response for 12 hours in localStorage
 *
 * @param url
 * @param options
 * @param maxAge null (12 hours) or maximum age in second
 */
function cacheFetchJson(url: string, options: RequestInit, maxAge: number | null): Promise<any> {
    // in cache and not expired
    const cached = localStorage.getItem(options.method + ":" + url);
    if (cached) {
        const item: CachedItem = JSON.parse(cached);
        if ((Date.now() - item.time) < (maxAge || CACHE_MAX_AGE)) {
            return new Promise((resolve) => {
                resolve(item.data);
            });
        }
    }

    // not in cache or expired
    return fetch(url, options)
        .then(resp => resp.json())
        .then(json => {
            localStorage.setItem(options.method + ":" + url.toString(), JSON.stringify({time: Date.now(), data: json}));
            return json;
        });
}

/**
 * Cache fetch Text response for 12 hours in localStorage
 *
 * @param url
 * @param options
 * @param maxAge null (12 hours) or maximum age in second
 */
function cacheFetchText(url: string, options: RequestInit, maxAge: number | null): Promise<any> {
    // in cache and not expired
    const cached = localStorage.getItem(options.method + ":" + url);
    if (cached) {
        const item: CachedItem = JSON.parse(cached);
        if ((Date.now() - item.time) < (maxAge || CACHE_MAX_AGE)) {
            return new Promise((resolve) => {
                resolve(item.data);
            });
        }
    }

    // not in cache or expired
    return fetch(url, options)
        .then(resp => resp.text())
        .then(text => {
            localStorage.setItem(options.method + ":" + url.toString(), JSON.stringify({time: Date.now(), data: text}));
            return text;
        });
}

export {cacheFetchJson, cacheFetchText}
