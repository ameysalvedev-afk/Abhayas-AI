import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/questions': 'http://127.0.0.1:8000',
      '/submit-test': 'http://127.0.0.1:8000',
      '/generate-explanation': 'http://127.0.0.1:8000',
      '/generate-report': 'http://127.0.0.1:8000',
    }
  }
})
