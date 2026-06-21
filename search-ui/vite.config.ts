import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteEnvCheckPlugin } from '@ala/common-ui/viteEnvCheckPlugin';

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    plugins: [react(), viteEnvCheckPlugin()],
    optimizeDeps: {
        exclude: ['@ala/common-ui'],
    },
    server: {
        fs: {
            allow: ['..'], // allow access to linked packages outside root
        },
    },
});
