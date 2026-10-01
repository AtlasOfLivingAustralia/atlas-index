// Fixture for viteRuntimeConfigPlugin.integration.test.ts: a one-file library built with the real plugin.
import { defineConfig } from 'vite';
import { viteRuntimeConfigPlugin } from '../../src/viteRuntimeConfigPlugin.ts';

export default defineConfig({
    logLevel: 'silent',
    plugins: [viteRuntimeConfigPlugin()],
    build: {
        minify: false,
        lib: { entry: process.env.FIXTURE_ENTRY ?? 'src/main.ts', formats: ['iife'], name: 'fixture', fileName: () => 'out.js' }
    }
});
