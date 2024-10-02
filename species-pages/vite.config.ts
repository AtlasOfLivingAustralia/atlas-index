import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/species/', // This is because we are deploying to a subdirectory
  plugins: [react()],
})
