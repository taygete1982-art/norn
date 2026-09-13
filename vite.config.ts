import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: process.cwd(),
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'pixi-core': ['pixi.js']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@iso': resolve(__dirname, 'src/iso'),
      '@platform': resolve(__dirname, 'src/platform')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts']
  },
  server: {
    port: 5174,
    strictPort: true
  }
})
