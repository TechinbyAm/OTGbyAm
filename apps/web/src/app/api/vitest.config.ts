import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `root` must be set explicitly — Vitest resolves it relative to the
// invoking CWD (apps/web), not this config file's own directory, so without
// this the default include pattern picks up tests everywhere, not just
// src/app/api/**. Confirmed by running `test:api` before this fix: it
// incorrectly picked up src/utils/theme.test.ts too (7 tests instead of 3).
// The sibling ../../../vitest.config.ts (jsdom) explicitly excludes
// src/app/api/** so the two configs never overlap in either direction.
export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
  },
});