import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'parser': ['./src/workers/mbox-parser.worker.ts']
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
})
