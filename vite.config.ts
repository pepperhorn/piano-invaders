/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Library build: every bare import stays external (react, react-dom, smplr, ivories, ...). */
const isExternal = (id: string) =>
  !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !/^[A-Za-z]:[\\/]/.test(id)

// App build (default): `npm run build` -> dist/
// Library build: `npm run build:lib` (vite --mode lib) -> lib/ (+ lib/types, lib/style.css)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: mode === 'lib'
    ? {
        outDir: 'lib',
        emptyOutDir: true,
        copyPublicDir: false,
        sourcemap: true,
        lib: { entry: { index: 'src/index.ts' }, formats: ['es'] },
        rolldownOptions: { external: isExternal },
      }
    : { outDir: 'dist' },
  test: {
    name: 'piano-invaders',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
}));
