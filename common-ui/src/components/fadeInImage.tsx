/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState, useEffect, useRef} from "react";

type FadeInImageProps = {
    missingImage: string;
    placeholderDimensions?: number[]; // [width, height]
    usePlaceholder?: boolean; // If true, a placeholder will be shown while the image is loading and fade-in effect is disabled.
    onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
} & React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * A React component that displays an image with a fade-in effect. This is the default, however it can also
 * display a placeholder with glow while the image is loading. It handles errors by displaying a missing image placeholder.
 *
 * @param missingImage
 * @param loadingPlaceholderDimensions
 * @param onError
 * @param props
 * @constructor
 */
export function FadeInImage({missingImage, placeholderDimensions, usePlaceholder, onError, ...props}: FadeInImageProps) {
    const [loaded, setLoaded] = useState(false);
    const [currentWidth, setCurrentWidth] = useState<number | undefined>(placeholderDimensions ? placeholderDimensions[0] : undefined);
    const [currentHeight, setCurrentHeight] = useState<number | undefined>(placeholderDimensions ? placeholderDimensions[1] : undefined);

    const imgRef = useRef<HTMLImageElement | null>(null);

    console.log(currentHeight, currentWidth, "initial dimensions");

    useEffect(() => {
        setLoaded(false);
    }, [props.src]);

    useEffect(() => {
        if (loaded && imgRef.current) {
            const rect = imgRef.current.getBoundingClientRect();

            setCurrentWidth(rect.width);
            setCurrentHeight(rect.height);
        }
        console.log("Image loaded:", loaded, "Current dimensions:", currentWidth, currentHeight);
    }, [loaded]);

    return <>
        {!loaded && usePlaceholder && <div className="placeholder-glow" style={{
            width: currentWidth,
            height: currentHeight,
            borderRadius: "10px",
            overflow: "hidden",
            position: "absolute",
            top: 0,
            left: 0,
            background: "#e0e0e0"
        }}>
            <span className="placeholder col-12" style={{height: "100%", display: "block"}}></span>
        </div>}
        <img
            ref={imgRef}
            {...props}
            style={{
                ...props.style,
                opacity: loaded ? 1 : 0,
                ...(usePlaceholder ? {} : { transition: "opacity 0.5s ease" })
            }}
            onLoad={() => {
                setLoaded(true);
            }}
            onError={e => {
                e.currentTarget.src = missingImage;
                setLoaded(true);
                if (onError) {
                    onError(e);
                }
            }}
        />
    </>

}
