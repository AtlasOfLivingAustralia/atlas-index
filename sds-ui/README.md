## ALA SDS static home page (legacy)

Before ALA was using `ala-sensitive-data-service`, it had `sds-webapp2`, which was a Grails app that pulled in the `sds` libary. It served API endpoints, generated the `sensitive-species-data.xml` file and provided a simple web front end via the URL `sds.ala.org.au`.  `ala-sensitive-data-service` took over the API duties and the XML file generation has been moved to an Airflow job, resulting in the XML files being saved to s3.

This directory contains the static HTML file for the home page from `sds-webapp2`. It links to the XML files via either a direct HTTP Cloudfront URL to the s3 file or by linking to the API for `ala-sensitive-data-service`. The HTML file should be served from s3 via Cloudfriont, similar to the `sensitive-species-data.xml` file.

