// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ocmovies/',                 // keep this so dev URLs still use /ocmovies/
  server: {
    proxy: {
      // Anything starting with /ocmovies/api will be forwarded to your Node server
      '/ocmovies/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // If your Express server doesn't include /ocmovies in its route paths
        // (it doesn't – it uses /api/... only), we strip the prefix:
        rewrite: (path) => path.replace(/^\/ocmovies/, ''),
      },
    },
  },
})
