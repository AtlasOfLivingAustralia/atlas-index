## General API (Biocache)

### TODO: Fix the CORS issue for Swagger's Try button, and other use cases
There are already issues with CORS.
1. http (local dev) to https (test or production) is a problem.
2. Local development trouble because Access-Control-Allow-Origin:* is not allowed with credentials.
3. Local development server address/s can be permitted by nginx changes. Are other changes required on the server side?
4. No idea what goes on with the API Gateway.
5. The interceptor on swagger's 'Try' button always injects authorisation because it does not know when it is not required.

### TODO: Fix the api spec
When the API spec is faulty it can cause problems.
1. The server listing should be accurate and complete. e.g. http:// or https://, API Gateway and/or direct server address.

### Another title
Some more comments

### A link to a map example
<a target="_blank" href="http://localhost:8082/static/html/map.html?occurrencesUrl=env.VITE_APP_BIOCACHE_URL">Map example</a>
