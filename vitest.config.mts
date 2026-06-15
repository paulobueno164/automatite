import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      'server-only': new URL('./node_modules/server-only/empty.js', import.meta.url).pathname,
    },
  },
})
