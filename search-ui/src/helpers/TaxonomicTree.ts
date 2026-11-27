/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface TaxonomicFacetNode {
    label: string;
    count: number;
    fq: string;
    fieldValue?: string;
    children?: TaxonomicFacetNode[];
}

export interface TaxonomicTreeItem {
    fq: string;
    label: string;
    i18nKey: string;
    count: number;
    depth: number;
    selected?: boolean;
}

export function formatTaxonomicLabel(raw: string): string {
    if (!raw) {
        return '';
    }
    if (raw === raw.toUpperCase() && raw !== raw.toLowerCase()) {
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    return raw;
}

function extractRankFromFq(fq: string): string | undefined {
    const matches = [...fq.matchAll(/(?:^| AND )rk_([a-zA-Z0-9_]+):/g)];
    const last = matches[matches.length - 1];
    return last ? last[1].toLowerCase() : undefined;
}

function collectTaxonomicNodes(
    nodes: TaxonomicFacetNode[],
    depth: number,
    out: TaxonomicTreeItem[]
): void {
    nodes.forEach((node) => {
        const rawLabel = node.label ?? '';
        const rank = extractRankFromFq(node.fq);
        const i18nKey = rawLabel
            ? rank
                ? `taxonomy.${rank}.${rawLabel.toLowerCase()}`
                : 'taxonomy.' + rawLabel.toLowerCase()
            : '';
        out.push({
            fq: node.fq,
            label: formatTaxonomicLabel(rawLabel),
            i18nKey,
            count: node.count,
            depth,
        });
        if (node.children && node.children.length > 0) {
            collectTaxonomicNodes(node.children, depth + 1, out);
        }
    });
}

export function flattenTaxonomicTree(nodes: TaxonomicFacetNode[]): TaxonomicTreeItem[] {
    const out: TaxonomicTreeItem[] = [];
    collectTaxonomicNodes(nodes, 0, out);
    return out;
}

export function mergeTaxonomicTreeItems(
    existingItems: TaxonomicTreeItem[],
    newItems: TaxonomicTreeItem[],
    selectedFqs: string[]
): TaxonomicTreeItem[] {
    const merged: TaxonomicTreeItem[] = newItems.map((item) => ({
        ...item,
        selected: selectedFqs.includes(item.fq),
    }));
    const presentFqs = new Set(merged.map((item) => item.fq));
    const ancestorStack: TaxonomicTreeItem[] = [];

    for (const item of existingItems) {
        ancestorStack.length = item.depth;
        ancestorStack[item.depth] = item;

        if (!selectedFqs.includes(item.fq) || presentFqs.has(item.fq)) {
            continue;
        }

        for (let d = 0; d <= item.depth; d++) {
            const node = ancestorStack[d];
            if (!node || presentFqs.has(node.fq)) {
                continue;
            }
            const preserved: TaxonomicTreeItem = {
                ...node,
                count: 0,
                selected: selectedFqs.includes(node.fq),
            };
            const parent = d > 0 ? ancestorStack[d - 1] : undefined;
            if (parent) {
                const parentIdx = merged.findIndex((m) => m.fq === parent.fq);
                if (parentIdx >= 0) {
                    let insertIdx = parentIdx + 1;
                    while (insertIdx < merged.length && merged[insertIdx].depth > parent.depth) {
                        insertIdx++;
                    }
                    merged.splice(insertIdx, 0, preserved);
                } else {
                    merged.push(preserved);
                }
            } else {
                merged.push(preserved);
            }
            presentFqs.add(node.fq);
        }
    }

    return merged;
}
