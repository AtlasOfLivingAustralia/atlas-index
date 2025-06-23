/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import classes from "./search.module.css";
import {RenderItemElements, RenderItemParams} from "../../api/sources/model.ts";
import {FadeInImage} from "../common-ui/fadeInImage.tsx";
import missingImage from '../../image/missing-image.png';

function limitDescription(description: string, max: number): string {
    if (description && description.length > max) {
        // TODO: try to avoid cutting off words
        return description.substring(0, max) + "...";
    }
    return description;
}

function openUrl(url: string) {
    window.open(url, "_blank");
}

const getImageThumbnailUrl = (id: string) => {
    return `${import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL}${id}`;
}

const renderGenericListItemFn = ({wide, isMobile}: RenderItemParams, elements: RenderItemElements) => {
    const hasImage = elements.image !== undefined && elements.image !== null && elements.image !== "";
    const screenWidth = window.innerWidth;

    const fistColWidth: string = hasImage && !isMobile ? (wide ? "350px" : "310px") : (isMobile ? screenWidth/2 + "px" : (wide ? "442px" : "400px"));
    // const secondColWidth: string = wide ? "250px" : "200px";
    const thirdColMaxWidth: string = wide ? "700px" : "490px";
    return <div className={"d-flex align-items-start flex-row gap-4"}
                style={{cursor: "pointer"}}
                onClick={() => elements.clickFn()}>
        {!isMobile && elements.image}
        <div style={{width: fistColWidth, flexShrink: 0}}>
            {elements.title}
            {elements.extra}
        </div>
        {/*{!isMobile && elements.extra &&*/}
        {/*    <div style={{width: secondColWidth, flexShrink: 0}}>*/}
        {/*        {elements.extra}*/}
        {/*    </div>*/}
        {/*}*/}
        {elements.description &&
            <div style={{minWidth: "100px", maxWidth: thirdColMaxWidth}} className={classes.listDescription}>
                {elements.description}
            </div>
        }
    </div>
}

const renderGenericTileItemFn = (isMobile: boolean, elements: RenderItemElements) => {
    const hasImage = elements.image !== undefined && elements.image !== null && elements.image !== "";

    return <div className={(hasImage ? classes.tile : classes.tileNoImage) + (isMobile ? " d-flex flex-row align-items-start" : "")} onClick={() => elements.clickFn()}>
        {hasImage && elements.image}

        <div className={classes.tileContent}>
            {elements.title}
        </div>
    </div>
}

const TileImage = ({image, isMobile}: {image: string | undefined, isMobile: boolean}) => {
    return <FadeInImage
        height={isMobile ? 100 : 150}
        width={isMobile ? "80px" : "100%"}
        style={{objectFit: image ? "contain" : "cover", objectPosition: image ? "top" : "inherit"}}
        onError={(e) => {
            (e.target as HTMLImageElement).style.objectFit = "cover";
            (e.target as HTMLImageElement).style.objectPosition = "inherit";
        }}
        src={image || missingImage}
        missingImage={missingImage}
        />
}

export {limitDescription, openUrl, getImageThumbnailUrl, renderGenericListItemFn, renderGenericTileItemFn, TileImage};
