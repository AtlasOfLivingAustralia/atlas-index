import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteEnvCheckPlugin } from '@ala/common-ui/viteEnvCheckPlugin';
import { viteStaticServerPlugin } from '@ala/common-ui/viteStaticServerPlugin';
import dotenv from 'dotenv';
import path from 'node:path';
import istanbul from 'vite-plugin-istanbul';

const isPlaywright = process.env.PLAYWRIGHT_ENV === 'true';

if (isPlaywright) {
    const envFile = `.env.playwright`;
    console.log(`Loading environment variables from ${envFile}`);
    dotenv.config({ path: path.resolve(__dirname, envFile) });
}

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        'process.env': process.env,
    },
    plugins: [
        react(),
        viteEnvCheckPlugin(),
        viteStaticServerPlugin(),
        ...(isPlaywright
            ? [
                  istanbul({
                      include: 'src/**',
                      exclude: ['node_modules', 'tests/**'],
                      extension: ['.ts', '.tsx'],
                      requireEnv: false,
                      forceBuildInstrument: true,
                  }),
              ]
            : []),
    ],
    build: {
        rollupOptions: {
            ...(isPlaywright
                ? {
                      onwarn(warning, warn) {
                          // vite-plugin-istanbul injects /* @__PURE__ */ annotations in positions
                          // that Rolldown rejects as invalid. The build output is still correct.
                          if (warning.code === 'INVALID_ANNOTATION') return;
                          warn(warning);
                      },
                  }
                : {}),
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
