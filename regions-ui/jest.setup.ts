import 'core-js';

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Stand-in for Vite's `import.meta.env` (see babel-plugin-import-meta.cjs),
// providing sensible defaults for the env vars referenced by src/**.
(globalThis as any).__IMPORT_META__ = {
    env: {
        VITE_HOME_URL: 'https://home.example.org',
        VITE_EXPLORE_URL: 'https://explore.example.org',
        VITE_ENV: 'test',
        VITE_COMMON_CSS: '',
        VITE_COMMON_HEADER_HTML: '',
        VITE_COMMON_FOOTER_HTML: '',
        VITE_COMMON_JS: '',
        VITE_COMMON_CONTAINER_CLASS: '',
        VITE_SEARCH_URL_PREFIX: '',
        VITE_BANNER_MESSAGES_URL: '',
        VITE_BANNER_SCOPE: '',
        VITE_APP_API_URL: 'https://api.example.org',
        VITE_APP_BASE_URL: 'https://app.example.org',
        VITE_SPATIAL_WS_URL: 'https://spatial.example.org/ws',
        VITE_SPATIAL_GEOSERVER_URL: 'https://spatial.example.org/geoserver',
        VITE_APP_BIOCACHE_URL: 'https://biocache.example.org/ws',
        VITE_APP_BIOCACHE_UI_URL: 'https://biocache.example.org',
        VITE_DOWNLOAD_URL: 'https://download.example.org',
        VITE_SPECIES_PAGE_URL: 'https://species.example.org/',
        VITE_APP_ALERTS_URL: 'https://alerts.example.org',
        VITE_APP_ALERT_RESOURCE_NAME: 'regions',
        VITE_REGIONS_CONFIG_URL: 'https://static.example.org/regions.json',
        VITE_MAP_CENTRE_LAT: '-25.27',
        VITE_MAP_CENTRE_LNG: '133.77',
        VITE_MAP_DEFAULT_ZOOM: '4',
        VITE_GLOBAL_FQ: '',
        VITE_PLAYER_INTERVAL_MILLISECONDS: '1000',
        VITE_OPENSTREETMAP_ZXY_URL: 'https://tiles.example.org/{z}/{x}/{y}.png',
        VITE_GOOGLE_MAP_API_KEY: '',
    },
};
