import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/projects': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/exports': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});