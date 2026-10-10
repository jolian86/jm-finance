import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // GitHub Pages: /jm-finance/ (padrão). Cloudflare Pages: BASE=/ (npm run build:cf)
  base: (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env.BASE || '/jm-finance/',
  build: { chunkSizeWarningLimit: 600, rollupOptions: { output: { manualChunks: { charts: ['recharts'], motion: ['framer-motion'], react: ['react', 'react-dom'] } } } },
})
