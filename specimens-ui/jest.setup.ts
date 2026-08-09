import 'core-js';

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Values normally supplied by Vite's `import.meta.env` at build time.
// `babel-plugin-transform-import-meta` (see babel.jest.config.cjs) rewrites
// `import.meta.env` to `process.env` so these are used under Jest.
process.env.VITE_HOME_URL = 'https://ala.org.au';
process.env.VITE_PAGE_SIZE = '2';
process.env.VITE_APP_BIOCACHE_URL = 'https://biocache-ws.ala.org.au/ws';
process.env.VITE_APP_BIOCACHE_UI_URL = 'https://biocache.ala.org.au';
process.env.VITE_APP_IMAGES_URL = 'https://images.test.ala.org.au';
