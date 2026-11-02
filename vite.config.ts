import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The KM API (atm-km-api) runs on 3081. Proxying keeps the web and the API
    // on one origin in development, so the SameSite=Strict session cookie works
    // exactly as in production behind nginx.
    proxy: {
      '/api': 'http://localhost:3081',
    },
  },
})
