/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Link} from 'react-router-dom';
import type {ImageSummary} from '../api/types';
import './thumbnailGrid.css';

interface ThumbnailGridProps {
    results: ImageSummary[];
    apiUrl?: string;
}

/** Public search results grid — thumbnails link through to the image/media detail view. */
export default function ThumbnailGrid({results, apiUrl: customApiUrl}: ThumbnailGridProps) {
    const apiUrl = customApiUrl || import.meta.env.VITE_APP_IMAGES_API_URL || '';
    if (results.length === 0) {
        return <div className="alert alert-light border" data-testid="no-results">No images matched your search.</div>;
    }

    return (
        <div className="thumbnail-grid" data-testid="thumbnail-grid">
            {results.map((image, idx) => {
                const imageId = image.imageId || (image as any).imageIdentifier || `image-${idx}`;
                const thumbnailUrl = image.thumbnailUrl || (imageId ? `${apiUrl}/image/${encodeURIComponent(imageId)}/thumbnail` : '');
                const title = image.title || image.originalFilename || (image as any).originalFileName || imageId;

                return (
                    <Link key={imageId} to={`/image/${encodeURIComponent(imageId)}`} className="thumbnail-card" data-testid="thumbnail-card">
                        <div className="thumbnail-card-image">
                            <img src={thumbnailUrl} alt={title} loading="lazy"/>
                        </div>
                        <div className="thumbnail-card-title" title={title}>
                            {title}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
