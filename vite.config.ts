import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  base: process.env.PAGES_BASE || '/',
  build: {
    chunkSizeWarningLimit: 700,
  },
})
