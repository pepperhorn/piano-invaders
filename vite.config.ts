/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App build (default): `npm run build` -> dist/
// Library build (`npm run build:lib` -> lib/) is defined in Task 10.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  test: {
    name: 'piano-invaders',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
