import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // `test-setup-jsdom-animation-events.ts` DEBE ir primero — polyfilla `window.AnimationEvent`
    // antes de que `test-setup.ts` importe `@testing-library/react` (y por tanto `react-dom`), ver
    // el comentario de cabecera de ese archivo.
    setupFiles: ['./src/test-setup-jsdom-animation-events.ts', './src/test-setup.ts']
  }
});
