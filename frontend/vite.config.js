import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read .env from the repo root, not from /frontend, so there is one
  // env file for the whole project (frontend and the /api functions both
  // read from it) instead of two separate ones to keep in sync.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
})
