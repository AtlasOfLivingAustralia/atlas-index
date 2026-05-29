/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from "react";
import LsidDropdown from "./lsidDropdown.tsx";

interface TaxonDropdownProps {
    htmlContent?: string;
}

// Matches <span ...> where the attributes contain both class="...lsid..." and id="..."
// Handles any attribute order, single or double quotes
const LSID_SPAN_RE = /<span(\s[^>]*?)>(.*?)<\/span>/gs;

function hasLsidClass(attrs: string): boolean {
    return /class\s*=\s*["'][^"']*\blsid\b[^"']*["']/.test(attrs);
}

function getAttr(attrs: string, name: string): string {
    const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`));
    return m ? m[1] : "";
}

// Parses htmlContent, splits on span.lsid, renders each piece with LsidDropdown replacements
function TaxonDropdown({ htmlContent }: TaxonDropdownProps) {
    if (!htmlContent) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;
    let match: RegExpExecArray | null;

    LSID_SPAN_RE.lastIndex = 0; // reset stateful regex

    while ((match = LSID_SPAN_RE.exec(htmlContent)) !== null) {
        const [fullMatch, attrs, innerHtml] = match;

        if (!hasLsidClass(attrs)) continue;

        const start = match.index;

        const before = htmlContent.slice(lastIndex, start);
        if (before) parts.push(<span key={`before_${matchIndex}`} dangerouslySetInnerHTML={{ __html: before }} />);

        const lsid = getAttr(attrs, "id");
        parts.push(<LsidDropdown key={`lsid_${matchIndex}`} lsid={lsid} nameString={innerHtml} index={matchIndex} />);

        lastIndex = start + fullMatch.length;
        matchIndex++;
    }

    if (matchIndex === 0) {
        return <span dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }

    const after = htmlContent.slice(lastIndex);
    if (after) parts.push(<span key="after" dangerouslySetInnerHTML={{ __html: after }} />);

    return <>{parts}</>;
}

export default TaxonDropdown;
