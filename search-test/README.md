# Testing tool

This tool compares output of GET requests returning JSON between two servers.

## Usage

Build

```shell
mvn package
```

Run example
```shell
java -jar target/search-test-0.0.1-SNAPSHOT-jar-with-dependencies.jar /data/bie/testUrls http://localhost:8080 http://localhost:8081 10 false
```

Usage
```
Usage: java -jar search-test.jar <fileOfUrls> <leftUrl> <rightUrl> <everyN> <preserveArrayOrder>

  <fileOfUrls> file containing a list of URLs. e.g. /data/bie/test/childConcepts
  <rightUrl> base URL of "right" server. e.g. http://localhost:8080 
  <leftUrl> base URL of "left" server. e.g. http://localhost:8081 
  <everyN> test every Nth row from the fileOfUrls, e.g. 1 or 1000
  <preserveArrayOrder> "true" or "false" to determine of array order is preserved in a comparison
```

Output
- The output file (fileOfUrls + ".test") will contain "row, inputUrl, response array or object size", followed by any errors detected.
- Console output will contain a list of URL paths that have different responses.
