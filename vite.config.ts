import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH lets the site be hosted under a sub-path (e.g. /build-showcase/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
