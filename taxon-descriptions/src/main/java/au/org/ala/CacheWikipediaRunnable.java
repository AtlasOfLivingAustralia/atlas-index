package au.org.ala;

import java.io.File;

public class CacheWikipediaRunnable implements Runnable {
    String wikiTitle;
    File outputFile;

    public CacheWikipediaRunnable(String wikiTitle, File outputFile) {
        this.wikiTitle = wikiTitle;
        this.outputFile = outputFile;
    }

    @Override
    public void run() {
        System.out.println("attempted caching of:" + wikiTitle + ", " + outputFile);
        FetchData.cacheWikipediaSummary(wikiTitle, outputFile);
    }

}
