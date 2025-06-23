/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {GenericViewProps, RenderItemElements, RenderItemParams} from "../../../api/sources/model.ts";
import classes from "../search.module.css";
import {limitDescription, openUrl, renderGenericListItemFn, renderGenericTileItemFn, TileImage} from "../util.tsx";
import missingImage from '../../../image/missing-image.png';
import {FadeInImage} from "../../common-ui/fadeInImage.tsx";

export const dataprojectsDefn: GenericViewProps = {
    fq: "idxtype:BIOCOLLECT OR idxtype:DIGIVOL",

    sortByDate: true,

    facetDefinitions: {
        "projectType": {
            label: "Type",
            order: 1
        }
    },

    renderListItemFn: ({item, navigate, wide, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <FadeInImage
                className={classes.listItemImage}
                src={item.image || missingImage}
                missingImage={missingImage}
            />,
            title: <>
                <span className={classes.listItemName}>{item.name}</span>
            </>,
            extra: <>
                {/*<Text><FolderIcon color="#637073"/> contains {item.occurrenceCount} records</Text>*/}
            </>,
            description: <>
                <span title={item.description}
                      className={classes.listDescription}>{limitDescription(item.description, isMobile ? 80 : (wide ? 230 : 120))}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericListItemFn({item, navigate, wide, isMobile}, elements);
    },

    renderTileItemFn: ({item, isMobile}: RenderItemParams) => {
        const elements: RenderItemElements = {
            image: <TileImage image={item.image} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: "13px"}}>{item.name}</span>
                <span title={item.description}
                      className={classes.listDescription}>{item.description}</span>
            </>,
            clickFn: () => openUrl(item.guid)
        }
        return renderGenericTileItemFn(isMobile, elements);
    },

    resourceLinks: [
        {
            label: "Biocollect",
            url: import.meta.env.VITE_APP_BIOCOLLECT_URL
        },
        {
            label: "Digivol",
            url: import.meta.env.VITE_APP_DIGIVOL_URL
        }
    ]
}
