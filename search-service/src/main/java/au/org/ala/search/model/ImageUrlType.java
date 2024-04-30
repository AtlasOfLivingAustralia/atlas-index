package au.org.ala.search.model;

public enum ImageUrlType {
    THUMBNAIL("/image/proxyImageThumbnail?imageId="),
    LARGE("/image/proxyImage?imageId="),
    SMALL("/image/proxyImageThumbnailLarge?imageId="),
    METADATA("/ws/image/");

    public final String path;

    ImageUrlType(String path) {
        this.path = path;
    }
}
