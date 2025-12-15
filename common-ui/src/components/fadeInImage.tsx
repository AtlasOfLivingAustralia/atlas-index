/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState, useEffect, useRef, JSX} from "react";

type FadeInImageProps = {
    missingImage: string,
    placeholderDimensions?: number[],
    usePlaceholder?: boolean,
    onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void,
    showLoadingSpinner?: boolean
    calcDimensions?: boolean
} & React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * A React component that displays an image with a fade-in effect. This is the default, however it can also
 * display a placeholder with glow while the image is loading or a spinner. It handles errors by displaying a missing image placeholder.
 *
 * @param missingImage
 * @param loadingPlaceholderDimensions
 * @param onError
 * @param props
 * @constructor
 */
export function FadeInImage({
                                missingImage,
                                placeholderDimensions,
                                usePlaceholder,
                                onError,
                                showLoadingSpinner,
                                calcDimensions = true,
                                ...props
                            }: FadeInImageProps) {
    const [loaded, setLoaded] = useState(false);
    const [currentWidth, setCurrentWidth] = useState<number | undefined>(placeholderDimensions ? placeholderDimensions[0] : undefined);
    const [currentHeight, setCurrentHeight] = useState<number | undefined>(placeholderDimensions ? placeholderDimensions[1] : undefined);
    const [width, setWidth] = useState(window.innerWidth);

    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        if (loaded && imgRef.current) {
            // TODO: not happy with either this dimension setting or the resize handling as the reason it was added is
            //  no longer required but other things break when it is removed
            const rect = imgRef.current.getBoundingClientRect();
            setCurrentWidth(rect.width);
            setCurrentHeight(rect.height);
            const handleResize = () => setWidth(window.innerWidth);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [loaded, width]);

    function imgContent() : JSX.Element {
        return <img
            ref={imgRef}
            {...((({ popover, ...rest }) => rest)(props))}
            style={{
                ...props.style,
                opacity: loaded ? 1 : 0, ...(usePlaceholder ? {} : {transition: "opacity 0.5s ease"})
            }}
            onLoad={() => setLoaded(true)}
            onError={e => {
                e.currentTarget.src = missingImage;
                setLoaded(true);
                if (onError) {
                    onError(e);
                }
            }}
        />
    }

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
        {!loaded && showLoadingSpinner && (
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 2
            }}>
                <div className="spinner-border text-secondary" style={{fontSize: "16px"}} role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        )}
        {calcDimensions ?
            <div style={{minWidth: currentWidth, minHeight: currentHeight}}>
                {imgContent()}
            </div>
            :
            imgContent()
        }
    </>

}
