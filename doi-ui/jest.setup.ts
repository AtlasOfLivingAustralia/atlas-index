import 'core-js';

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Values normally supplied by Vite's `import.meta.env` at build time.
// `babel-plugin-transform-import-meta` (see babel.jest.config.cjs) rewrites
// `import.meta.env` to `process.env` so these are used under Jest.
process.env.VITE_HOME_URL = 'https://ala.org.au';
process.env.VITE_APP_API_URL = 'http://localhost:8081';
process.env.VITE_APP_BASE_URL = 'http://localhost:5173';
process.env.VITE_APP_DOI_URL = 'http://localhost:8081/v1';
process.env.VITE_APP_DOI_RESOLVER = 'https://api.test.datacite.org/';
process.env.VITE_APP_ROLE_ADMIN = 'ROLE_ADMIN';
process.env.VITE_APP_BIOCACHE_URL = 'https://biocache-ws.test.ala.org.au/ws';
process.env.VITE_COMMON_HEADER_HTML = 'http://localhost:8082/static/common/banner.mustache';
process.env.VITE_COMMON_FOOTER_HTML = 'http://localhost:8082/static/common/footer.mustache';
process.env.VITE_COMMON_CSS = 'http://localhost:8082/static/common/ala-combined.css';
process.env.VITE_COMMON_JS = 'http://localhost:8082/static/common/ala-combined.js';
process.env.VITE_COMMON_CONTAINER_CLASS = 'container-fluid';
process.env.VITE_SEARCH_URL_PREFIX = 'https://bie.test.ala.org.au';
process.env.VITE_BANNER_MESSAGES_URL = 'http://localhost:8082/static/common/status.json';
process.env.VITE_BANNER_SCOPE = 'species';
process.env.VITE_ENV = 'local';

// jsdom does not implement window.scrollTo; stub it so components that call
// it on navigation don't log "not implemented" errors.
window.scrollTo = jest.fn();
