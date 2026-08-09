import 'core-js';

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Values normally supplied by Vite's `import.meta.env` at build time.
// `babel-plugin-transform-import-meta` (see babel.jest.config.cjs) rewrites
// `import.meta.env` to `process.env` so these are used under Jest.
process.env.VITE_HOME_URL = 'https://ala.org.au';
process.env.VITE_ENV = 'test';
process.env.VITE_COMMON_CSS = '';
process.env.VITE_COMMON_HEADER_HTML = '';
process.env.VITE_COMMON_FOOTER_HTML = '';
process.env.VITE_COMMON_JS = '';
process.env.VITE_COMMON_CONTAINER_CLASS = '';
process.env.VITE_SEARCH_URL_PREFIX = '';
process.env.VITE_BANNER_MESSAGES_URL = '';
process.env.VITE_BANNER_SCOPE = '';
process.env.VITE_APP_API_URL = 'https://api.example.org';
process.env.VITE_APP_BASE_URL = 'https://app.example.org';
process.env.VITE_APP_BIOCACHE_URL = 'https://biocache-ws.ala.org.au/ws';
process.env.VITE_APP_DASHBOARD_DATA_URL = 'https://dashboard.example.org/dashboard.json';
process.env.VITE_APP_DASHBOARD_ZIP_URL = 'https://dashboard.example.org/dashboard.zip';
