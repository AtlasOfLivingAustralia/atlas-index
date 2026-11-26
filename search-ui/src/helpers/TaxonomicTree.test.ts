/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    flattenTaxonomicTree,
    formatTaxonomicLabel,
    TaxonomicFacetNode,
} from './TaxonomicTree.ts';

describe('TaxonomicTree helpers', () => {
    it('normalises ALL-CAPS taxonomic labels to Title Case and preserves mixed-case labels', () => {
        expect(formatTaxonomicLabel('ANIMALIA')).toBe('Animalia');
        expect(formatTaxonomicLabel('INSECTA')).toBe('Insecta');
        expect(formatTaxonomicLabel('DIPROTODONTIA')).toBe('Diprotodontia');
        expect(formatTaxonomicLabel('Plantae')).toBe('Plantae');
        expect(formatTaxonomicLabel('Equisetopsida')).toBe('Equisetopsida');
        expect(formatTaxonomicLabel('Viruses')).toBe('Viruses');
        expect(formatTaxonomicLabel('')).toBe('');
    });

    it('flattens Kingdom -> Class -> Order hierarchy preserving count order, depth, raw fq, and i18n keys', () => {
        const tree: TaxonomicFacetNode[] = [
            {
                label: 'ANIMALIA',
                count: 7,
                fq: 'rk_kingdom:"ANIMALIA"',
                children: [
                    {
                        label: 'INSECTA',
                        count: 3,
                        fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA"',
                        children: [
                            {
                                label: 'COLEOPTERA',
                                count: 2,
                                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA" AND rk_order:"COLEOPTERA"',
                            },
                            {
                                label: 'HYMENOPTERA',
                                count: 1,
                                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA" AND rk_order:"HYMENOPTERA"',
                            },
                        ],
                    },
                    {
                        label: 'MAMMALIA',
                        count: 2,
                        fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"MAMMALIA"',
                        children: [
                            {
                                label: 'DIPROTODONTIA',
                                count: 2,
                                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"MAMMALIA" AND rk_order:"DIPROTODONTIA"',
                            },
                        ],
                    },
                    {
                        // Promoted order when intermediate rk_class is missing
                        label: 'ORPHANORDER',
                        count: 1,
                        fq: 'rk_kingdom:"ANIMALIA" AND rk_order:"ORPHANORDER"',
                    },
                ],
            },
            {
                label: 'Viruses',
                count: 1,
                fq: 'rk_kingdom:"Viruses"',
            },
        ];

        const flattened = flattenTaxonomicTree(tree);
        expect(flattened).toEqual([
            {
                fq: 'rk_kingdom:"ANIMALIA"',
                label: 'Animalia',
                i18nKey: 'taxonomy.kingdom.animalia',
                count: 7,
                depth: 0,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA"',
                label: 'Insecta',
                i18nKey: 'taxonomy.class.insecta',
                count: 3,
                depth: 1,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA" AND rk_order:"COLEOPTERA"',
                label: 'Coleoptera',
                i18nKey: 'taxonomy.order.coleoptera',
                count: 2,
                depth: 2,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"INSECTA" AND rk_order:"HYMENOPTERA"',
                label: 'Hymenoptera',
                i18nKey: 'taxonomy.order.hymenoptera',
                count: 1,
                depth: 2,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"MAMMALIA"',
                label: 'Mammalia',
                i18nKey: 'taxonomy.class.mammalia',
                count: 2,
                depth: 1,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_class:"MAMMALIA" AND rk_order:"DIPROTODONTIA"',
                label: 'Diprotodontia',
                i18nKey: 'taxonomy.order.diprotodontia',
                count: 2,
                depth: 2,
            },
            {
                fq: 'rk_kingdom:"ANIMALIA" AND rk_order:"ORPHANORDER"',
                label: 'Orphanorder',
                i18nKey: 'taxonomy.order.orphanorder',
                count: 1,
                depth: 1,
            },
            {
                fq: 'rk_kingdom:"Viruses"',
                label: 'Viruses',
                i18nKey: 'taxonomy.kingdom.viruses',
                count: 1,
                depth: 0,
            },
        ]);
    });

    it('returns an empty array for empty input', () => {
        expect(flattenTaxonomicTree([])).toEqual([]);
    });

    it('handles missing or empty labels without throwing', () => {
        const nodes = [{ label: '', count: 1, fq: 'rk_kingdom:""' }];
        expect(flattenTaxonomicTree(nodes)).toEqual([
            {
                fq: 'rk_kingdom:""',
                label: '',
                i18nKey: '',
                count: 1,
                depth: 0,
            },
        ]);
    });
});
