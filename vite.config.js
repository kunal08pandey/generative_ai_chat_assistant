import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose application to local network (0.0.0.0)
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
      '/rag': 'http://127.0.0.1:8000',
      '/generate-image': 'http://127.0.0.1:8000',
      '/models': 'http://127.0.0.1:8000',
      '/upload': 'http://127.0.0.1:8000',
      '/conversations': 'http://127.0.0.1:8000',
      '/messages': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
