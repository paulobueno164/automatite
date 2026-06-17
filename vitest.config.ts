import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      'server-only': 'src/lib/__mocks__/server-only.ts'
    }
  }
})
