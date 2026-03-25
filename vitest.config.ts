import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'dist/**', 'node_modules/**'],
    env: {
      NODE_ENV: 'test',
    },
  },
});
