import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteEnvCheckPlugin } from '@ala/common-ui/viteEnvCheckPlugin';
import { viteStaticServerPlugin } from '@ala/common-ui/viteStaticServerPlugin';
import path from 'node:path';
import dotenv from 'dotenv';
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
        'process.env': process.env
    },
    ...(isPlaywright
        ? {
              build: {
                  rollupOptions: {
                      onwarn(warning, warn) {
                          // vite-plugin-istanbul injects /* @__PURE__ */ annotations in positions
                          // that Rolldown rejects as invalid. The build output is still correct.
                          if (warning.code === 'INVALID_ANNOTATION') return;
                          warn(warning);
                      },
                  },
              },
          }
        : {}),
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
    optimizeDeps: {
        exclude: ['@ala/common-ui'],
    },
    server: {
        fs: {
            allow: ['..'], // allow access to linked packages outside root
        },
    },
});
