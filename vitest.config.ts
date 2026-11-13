import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    server: {
      deps: {
        inline: ['next-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Vitest node resolver: next-auth imports next/server without .js extension
      'next/server': path.resolve(__dirname, 'node_modules/next/server.js'),
    },
  },
})
