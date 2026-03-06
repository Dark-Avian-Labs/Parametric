import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'dist/**', 'node_modules/**'],
    setupFiles: ['server/test/setupEnv.ts'],
  },
});
