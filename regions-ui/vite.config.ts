import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from "node:path";

//if (process.env.PLAYWRIGHT_ENV === "true") {
//    const envFile = `.env.playwright`;
//    console.log(`Loading environment variables from ${envFile}`);
//    dotenv.config({ path: path.resolve(__dirname, envFile) });
//}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'process.env': process.env,
  },
  plugins: [react()],
  envDir: './config',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet', 'react-leaflet-google-layer'],
          chart: ['chart.js', 'react-chartjs-2']
        }
      }
    }
  }
})
