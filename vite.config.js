import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/budget-app/',
  server: {
    hmr: false, // Disable HMR in development
  },
})
