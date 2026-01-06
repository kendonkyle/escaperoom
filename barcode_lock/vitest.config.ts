import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});

