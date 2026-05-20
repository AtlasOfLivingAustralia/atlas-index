import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// fixes a build error
function leafletDrawInteropPlugin(): Plugin {
    return {
        name: 'leaflet-draw-interop',
        transform(code, id) {
            if (id.includes('leaflet-draw') && id.endsWith('.js') && !id.includes('node_modules/.vite')) {
                if (!code.includes('export default')) {
                    return {
                        code: code + '\nexport default typeof L !== "undefined" ? L.Draw : {};',
                        map: null
                    };
                }
            }
        }
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        'process.env': process.env
    },
    plugins: [react(), leafletDrawInteropPlugin()],
    optimizeDeps: {
        exclude: ['@ala/common-ui'],
        include: ['leaflet-draw']
    },
    server: {
        fs: {
            allow: ['..'] // allow access to linked packages outside root
        }
    }
});
