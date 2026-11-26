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

export function flattenTaxonomicTree(
    nodes: TaxonomicFacetNode[],
    depth: number = 0,
    out: TaxonomicTreeItem[] = []
): TaxonomicTreeItem[] {
    nodes.forEach((node) => {
        out.push({
            fq: node.fq,
            label: formatTaxonomicLabel(node.label),
            i18nKey: 'taxonomy.' + node.label.toLowerCase(),
            count: node.count,
            depth,
        });
        if (node.children && node.children.length > 0) {
            flattenTaxonomicTree(node.children, depth + 1, out);
        }
    });
    return out;
}
