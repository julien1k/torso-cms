import react from '@vitejs/plugin-react'
import { torso } from 'torso-cms/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [torso(), react()],
})
