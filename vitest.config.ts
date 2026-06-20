import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@/': path.resolve(__dirname, './src/'),
      'server-only': path.resolve(__dirname, './src/lib/mock-server-only.ts'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
