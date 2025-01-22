function limitDescription(description: string, max: number): string {
    if (description && description.length > max) {
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

export {limitDescription, openUrl, getImageThumbnailUrl};
