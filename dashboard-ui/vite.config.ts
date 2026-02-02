import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import dotenv from 'dotenv';

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
    optimizeDeps: {
        exclude: ['@ala/common-ui'],
    },
    server: {
        fs: {
            allow: ['..'], // allow access to linked packages outside root
        },
    },
});
