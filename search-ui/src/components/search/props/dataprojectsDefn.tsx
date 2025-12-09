/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FadeInImage, FolderIcon} from '@ala/common-ui';
import {GenericViewProps, RenderItemElements, RenderItemParams} from '../../../api/sources/model.ts';
import missingImage from '../../../image/missing-image.png';
import classes from '../search.module.css';
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn, TileImage} from '../util.tsx';

function formatCategory(category: string) {
    if (category == 'BIOCOLLECT') {
        return 'Biocollect';
    } else {
        return 'DigiVol';
    }
}

function formatDate(dateString: string) {
    if (!dateString) {
        return 'Ongoing';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

export const dataprojectsDefn: GenericViewProps = {
    fq: 'idxtype:BIOCOLLECT OR idxtype:DIGIVOL',

    sortByDate: true,

    facetDefinitions: {
        idxtype: {
            label: 'Type',
            order: 1,
            parseFacetFn: (facet: any, facetList: any[]) => {
                // basic facets, with custom label
                var items: any[] = [];
                facet.fieldResult.forEach((status: any) => {
                    var fq = facet.fieldName + ':"' + status.label + '"';
                    items.push({
                        fq: fq,
                        label: formatCategory(status.label),
                        count: status.count,
                        depth: 0,
                    });
                });
                if (items.length > 0) {
                    // sort by label
                    items.sort((a: any, b: any) => {
                        return a.label.localeCompare(b.label);
                    });

                    facetList.push({
                        name: 'Type',
                        items: items,
                        order: 1,
                    });
                }
            },
        },
        organisationName: {
            label: 'Funding organisation',
            order: 2
        },
    },

    renderListItemFn: ({item, navigate, wide, isMobile,}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <div className={classes.listItemImageDiv}><FadeInImage className={classes.listItemImagePlain} src={item.image || missingImage} missingImage={missingImage}/></div>,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
                <span className={classes.multilineText}>
                    {formatDate(item.plannedStartDate)} - {formatDate(item.plannedEndDate)}
                </span>
            </>,
            extra: <>
                { item.numberOfRecords > 0 &&
                    <span className={classes.multilineText}>
                        <FolderIcon/> contains {item.numberOfRecords} records
                    </span>
                }
                { item.publicParticipation &&
                    <span className={classes.multilineText}>
                        &#10003; Open to public participation
                    </span>
                }
            </>,
            description: <span title={item.description} className={classes.listDescription}>
                {limitDescription(item.description, isMobile ? 80 : wide ? 230 : 120)}
            </span>,
            clickFn: () => openUrl(item.guid),
        };
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} fit={'contain'} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: '13px'}}>
                    {item.name}
                </span>
                <span title={item.description} className={classes.listDescription}>
                    {item.description}
                </span>
            </>,
            clickFn: () => openUrl(item.guid),
        };
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: 'Biocollect',
            url: import.meta.env.VITE_APP_BIOCOLLECT_URL,
        },
        {
            label: 'DigiVol',
            url: import.meta.env.VITE_APP_DIGIVOL_URL,
        },
    ],
};
