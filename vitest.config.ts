import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    alias: {
      'server-only': path.resolve(__dirname, './src/lib/server-only-mock.ts'),
    },
  },
});
