import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'node:path';

if (process.env.PLAYWRIGHT_ENV === 'true') {
    const envFile = `.env.playwright`;
    console.log(`Loading environment variables from ${envFile}`);
    dotenv.config({ path: path.resolve(__dirname, envFile) });
}

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        'process.env': process.env,
    },
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (['leaflet', 'react-leaflet', 'react-leaflet-google-layer'].some(p => id.includes(`/node_modules/${p}/`))) return 'leaflet';
                    if (['chart.js', 'react-chartjs-2'].some(p => id.includes(`/node_modules/${p}/`))) return 'chart';
                },
            },
        },
    },
    optimizeDeps: {
        exclude: ['@ala/common-ui'],
    },
    server: {
        host: '0.0.0.0',
        fs: {
            allow: ['..'],
        },
    },
});
