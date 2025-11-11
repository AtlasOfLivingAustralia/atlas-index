/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function isObject(val: any): val is JsonObject {
    return val && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: any): val is JsonArray {
    return Array.isArray(val);
}

const styles: Record<string, React.CSSProperties> = {
    key: {color: "#a71d5d"},
    string: {color: "#0086b3"},
    number: {color: "#005cc5"},
    boolean: {color: "#e36209"},
    null: {color: "#6f42c1"},
    bracket: {color: "#333"},
    container: {fontFamily: "monospace", fontSize: 14, lineHeight: "1.5"},
    toggle: {cursor: "pointer", color: "#999", marginRight: 4},
};

function JsonViewer({data}: { data: JsonValue }) {
    const [globalCollapsed, setGlobalCollapsed] = useState<boolean | undefined>(undefined);
    return (
        <div style={styles.container}>
            <div style={{marginBottom: 8}}>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => setGlobalCollapsed(false)}
                >
                    Expand All
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setGlobalCollapsed(true)}
                >
                    Collapse All
                </button>
            </div>
            <JsonNode value={data} globalCollapsed={globalCollapsed}/>
        </div>
    );
}

function JsonNode({value, name, globalCollapsed}: { value: JsonValue; name?: string, globalCollapsed?: boolean; }) {
    const [collapsed, setCollapsed] = useState(!!name);

    // Sync local collapsed state with globalCollapsed
    useEffect(() => {
        if (globalCollapsed !== undefined) {
            setCollapsed(globalCollapsed);
        }
    }, [globalCollapsed]);

    if (isObject(value)) {
        const keys = Object.keys(value);
        return (
            <div>
                {name && <span style={styles.key}>{name}: </span>}
                <span
                    style={styles.toggle}
                    onClick={() => setCollapsed((c) => !c)}
                >
          [{collapsed ? "+" + Object.keys(value).length : "-"}]
        </span>
                <span style={styles.bracket}>{"{"}</span>
                {!collapsed && (
                    <div style={{paddingLeft: 16}}>
                        {keys.map((k) => (
                            <JsonNode key={k} name={k} value={value[k]} globalCollapsed={globalCollapsed}/>
                        ))}
                    </div>
                )}
                <span style={styles.bracket}>{"}"}</span>
            </div>
        );
    }
    if (isArray(value)) {
        return (
            <div>
                {name && <span style={styles.key}>{name}: </span>}
                <span
                    style={styles.toggle}
                    onClick={() => setCollapsed((c) => !c)}
                >
          [{collapsed ? "+" + value.length : "-"}]
        </span>
                <span style={styles.bracket}>[</span>
                {!collapsed && (
                    <div style={{paddingLeft: 16}}>
                        {value.map((v, i) => (
                            <JsonNode key={i} value={v} globalCollapsed={globalCollapsed}/>
                        ))}
                    </div>
                )}
                <span style={styles.bracket}>]</span>
            </div>
        );
    }
    return (
        <div>
            {name && <span style={styles.key}>{name}: </span>}
            <span style={
                typeof value === "string"
                    ? styles.string
                    : typeof value === "number"
                        ? styles.number
                        : typeof value === "boolean"
                            ? styles.boolean
                            : value === null
                                ? styles.null
                                : undefined
            }>
        {typeof value === "string"
            ? `"${value}"`
            : String(value)}
      </span>
        </div>
    );
}

export default JsonViewer;
