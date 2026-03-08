/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {FadeInImage} from '@ala/common-ui';
import {GenericViewProps, RenderItemElements, RenderItemParams} from '../../../api/sources/model.ts';
import missingImage from '../../../image/missing-image.png';
import classes from '../search.module.css';
import {limitDescription, renderGenericListItemFn, renderGenericTileItemFn, TileImage} from '../util.tsx';

export const articlesDefn: GenericViewProps = {
    fq: 'idxtype:WORDPRESS OR idxtype:KNOWLEDGEBASE',

    sortByDate: true,

    facetDefinitions: {
        classification1: {
            label: 'Type',
            order: 1,
        },
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <div className={classes.listItemImageDiv}><FadeInImage className={classes.listItemImageCoverRounded} src={item.image || missingImage} missingImage={missingImage}/></div>,
            title: <span className={classes.listItemName}>{item.name}</span>,
            extra: <span className={classes.overflowText}>{Array.isArray(item.classification1) ? item.classification1.join(', ') : item.classification1}</span>,
            description: <span className={classes.listDescription} title={item.description}>
                {limitDescription(item.description, isMobile ? 80 : wide ? 230 : 120)}
            </span>,
            url: item.guid
        };
        return renderGenericListItemFn(
            {item, navigate, wide, isMobile},
            elements
        );
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} fit={'cover'} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: '8px'}}>
                    {item.name}
                </span>
                {item.classification1 && (
                    <span className={classes.listItemText}>
                        {item.classification1}
                    </span>
                )}
                {item.description && (
                    <span style={{marginTop: '13px'}} className={classes.listDescription} title={item.description}>
                        {item.description}
                    </span>
                )}
            </>,
            url: item.guid
        };
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: 'Support',
            url: import.meta.env.VITE_APP_KNOWLEDGE_BASE_URL,
        }
    ],

};
