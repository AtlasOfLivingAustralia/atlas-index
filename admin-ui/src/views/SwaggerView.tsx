/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Breadcrumb, useUser } from '@ala/common-ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import Menu from '../components/menu.tsx';

/**
 * Parse VITE_SWAGGER_SOURCES env var.
 * Format: "name|url;name|url;..."
 * e.g. "biocache-service|https://biocache-ws.test.ala.org.au/ws/v3/api-docs;spatial-service|https://..."
 */
function parseSwaggerSources(): Array<{ name: string; url: string }> {
    const raw = import.meta.env.VITE_SWAGGER_SOURCES ?? '';
    return raw
        .split(';')
        .map((entry: string) => entry.trim())
        .filter(Boolean)
        .map((entry: string) => {
            const pipeIdx = entry.indexOf('|');
            if (pipeIdx === -1) return null;
            return { name: entry.slice(0, pipeIdx).trim(), url: entry.slice(pipeIdx + 1).trim() };
        })
        .filter(Boolean) as Array<{ name: string; url: string }>;
}

const swaggerSources = parseSwaggerSources();

/** Sentinel stored in Swagger UI's auth state when the user is logged in via SSO.
 *  Shows the padlock as locked without exposing the real JWT in the UI.
 *  The requestInterceptor detects this value and swaps in the real token at call time.
 *  If the user types their own value in the Authorize dialog it will not match,
 *  so it is left untouched. */
const SSO_SENTINEL = '__ALA_SSO__';

export default function SwaggerView({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const primaryName = searchParams.get('service') || (swaggerSources[0]?.name ?? '');
    const [spec, setSpec] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const bearerSchemes = useRef<Array<{ key: string; http: boolean }>>([]);
    const jwtRequired = useRef<Set<string>>(new Set());
    const swaggerSystem = useRef<any>(null);
    const latestToken = useRef<string | undefined>(undefined);

    const { userInfo } = useUser();

    // Keep the token ref in sync and re-authorize whenever it changes
    useEffect(() => {
        latestToken.current = userInfo?.accessToken;
        applyPreAuth(swaggerSystem.current);
    }, [userInfo?.accessToken]);

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Admin', href: '/' },
            { title: 'Swagger', href: '/swagger' }
        ]);
    }, []);

    useEffect(() => {
        const found = swaggerSources.find(s => s.name === primaryName);
        if (!found) return;
        setSpec(null);
        setLoadError(null);
        swaggerSystem.current = null;
        bearerSchemes.current = [];
        jwtRequired.current = new Set();
        fetch(found.url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(json => {
                parseSpecForJwtRequired(json);
                setSpec(json);
            })
            .catch(err => {
                setLoadError(`Failed to load spec from ${found.url}: ${err.message}`);
            });
    }, [primaryName]);

    function applyPreAuth(system: any) {
        if (!system || !latestToken.current) return;
        for (const { key, http } of bearerSchemes.current) {
            system.preauthorizeApiKey(key, http ? SSO_SENTINEL : `Bearer ${SSO_SENTINEL}`);
        }
    }

    // remove path parameters from a url fragment
    function filterPath(path: string): string {
        return path.replace(/[{*].*$/, '');
    }

    // Mutates the spec in place: simplifies the server URL, strips non-bearer
    // security schemes, and records the bearer scheme keys for pre-authorization.
    function parseSpecForJwtRequired(spec: any): void {
        const required = new Set<string>();
        for (const path in spec.paths) {
            const pathItem = spec.paths[path];
            for (const method in pathItem) {
                if ((pathItem[method] as any)?.security?.length > 0) {
                    required.add(`${method} ${filterPath(path)}`);
                }
            }
        }
        jwtRequired.current = required;

        let computedUrl: string | undefined;
        if (spec.servers?.length > 0) {
            let url: string = spec.servers[0].url;
            const variables: Record<string, { default?: string }> = spec.servers[0].variables ?? {};
            for (const [varName, varDef] of Object.entries(variables)) {
                url = url.replace(`{${varName}}`, varDef.default ?? '');
            }
            computedUrl = url;
        } else if (spec.host) {
            const scheme = (spec.schemes as string[] | undefined)?.[0] ?? 'https';
            const basePath: string = spec.basePath ?? '';
            computedUrl = `${scheme}://${spec.host}${basePath}`;
            delete spec.host;
            delete spec.basePath;
            delete spec.schemes;
        }
        if (computedUrl) {
            spec.servers = [{ url: computedUrl }];
        }

        const securitySchemes: Record<string, any> = spec.components?.securitySchemes ?? spec.securityDefinitions ?? {};
        const nativeBearer: Array<{ key: string; http: boolean }> = [];

        for (const [key, scheme] of Object.entries<any>(securitySchemes)) {
            if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
                nativeBearer.push({ key, http: true });
            } else if (scheme.type === 'openIdConnect' || scheme.type === 'oauth2') {
                // Leave untouched; interceptor's jwtRequired fallback handles auth.
            } else if (scheme.type === 'apiKey' && scheme.in === 'header' && (scheme.name === 'Authorization' || key.toLowerCase().includes('bearer') || key.toLowerCase().includes('jwt'))) {
                nativeBearer.push({ key, http: false });
            } else {
                delete securitySchemes[key];
            }
        }
        bearerSchemes.current = nativeBearer;
    }

    return (
        <div className='d-flex flex-row'>
            <Menu />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div className='container-fluid'>
                    <div className='d-flex mb-3'>
                        <div>
                            <label htmlFor='spec-select' className='form-label fw-bold me-2 mb-0 align-self-center'>
                                Select service:
                            </label>
                            <select id='spec-select' className='form-select w-auto d-inline-block' value={primaryName} onChange={e => setSearchParams({ service: e.target.value })}>
                                {swaggerSources.map(s => (
                                    <option key={s.name} value={s.name}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loadError && <div className='alert alert-danger'>{loadError}</div>}

                    {!spec && !loadError && (
                        <div className='d-flex mt-5'>
                            <div className='spinner-border ms-auto me-auto'></div>
                        </div>
                    )}

                    {spec && (
                        <SwaggerUI
                            spec={spec}
                            deepLinking={true}
                            onComplete={(system: any) => {
                                swaggerSystem.current = system;
                                applyPreAuth(system);
                                if (window.location.hash) {
                                    const el = document.querySelector(`a[href="${window.location.hash}"]`);
                                    if (el) el.scrollIntoView();
                                }
                            }}
                            requestInterceptor={(req: any) => {
                                const auth: string | undefined = req.headers['Authorization'];
                                if (auth?.includes(SSO_SENTINEL) && latestToken.current) {
                                    req.headers['Authorization'] = `Bearer ${latestToken.current}`;
                                } else if (!auth) {
                                    const authorized = swaggerSystem.current?.authSelectors?.authorized();
                                    const getVal = (obj: any): string | undefined => obj?.get?.('value') ?? obj?.value;

                                    let effectiveToken: string | undefined;
                                    for (const { key } of bearerSchemes.current) {
                                        const val = getVal(authorized?.get?.(key));
                                        if (val === SSO_SENTINEL) {
                                            effectiveToken = latestToken.current;
                                            break;
                                        } else if (val) {
                                            effectiveToken = val;
                                            break;
                                        }
                                    }
                                    if (!effectiveToken && bearerSchemes.current.length === 0) {
                                        effectiveToken = latestToken.current;
                                    }

                                    if (effectiveToken) {
                                        const method = (req.method ?? 'get').toLowerCase();
                                        let path: string;
                                        try {
                                            const reqUrl = new URL(req.url);
                                            const serverUrl = new URL(spec!.servers[0].url);
                                            path = reqUrl.pathname.startsWith(serverUrl.pathname) ? reqUrl.pathname.slice(serverUrl.pathname.length) || '/' : reqUrl.pathname;
                                            if (!path.startsWith('/')) path = '/' + path;
                                        } catch {
                                            path = req.url;
                                        }
                                        const requestEntry = `${method} ${path}`;
                                        if ([...jwtRequired.current].some(prefix => requestEntry.startsWith(prefix))) {
                                            req.headers['Authorization'] = `Bearer ${effectiveToken}`;
                                        }
                                    }
                                }
                                return req;
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
