import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/jm-finance/',
  build: { chunkSizeWarningLimit: 600, rollupOptions: { output: { manualChunks: { charts: ['recharts'], motion: ['framer-motion'], react: ['react', 'react-dom'] } } } },
})
