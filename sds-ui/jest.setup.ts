import 'core-js';

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Source files reference `import.meta.env.*` (Vite build-time env vars).
// babel-plugin-import-meta.cjs rewrites `import.meta` to this global so
// it behaves like a plain object under Jest/CommonJS.
(globalThis as any).__IMPORT_META__ = { env: {} };
