/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {
    limitDescription,
    openUrl,
    renderGenericListItemFn,
    renderGenericTileItemFn,
    TileImage
} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';
import {FadeInImage} from "../../common-ui/fadeInImage.tsx";

export const wordpressDefn: GenericViewProps = {
    fq: "idxtype:WORDPRESS",

    sortByDate: true,

    facetDefinitions: {
        "classification1": {
            label: "Type",
            order: 1
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements : RenderItemElements = {
            image: <FadeInImage
                className={classes.listItemImage}
                src={item.image || missingImage}
                missingImage={missingImage}
            />,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                <span className={classes.overflowText}>{item.classification1}</span>
            </>,
            description: <>
                <span className={classes.listDescription} title={item.description}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: "8px"}}>{item.name}</span>
                {item.classification1 && <span className={classes.listItemText}>{item.classification1}</span>}
                {item.description &&
                    <span  style={{marginTop: "13px"}} className={classes.listDescription} title={item.description}>{item.description}</span>}
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericTileItemFn(isMobile, elements);
    }
}
