import { defineConfig } from 'vitest/config';

// Root-level Vitest config for the workspace defined in `vitest.workspace.ts`.
//
// Vitest resolves each project's own `test.coverage` independently for
// instrumentation, but coverage *thresholds* are only checked once, against
// the merged coverage report, using the coverage options resolved from this
// root config (see `Vitest#initCoverageProvider` / `resolveThresholds` in
// vitest's core). Without this file, `npm run test:coverage` run from the
// repo root never fails on threshold violations even if an individual
// package's `vitest.config.ts` (e.g. packages/domain/combat) defines
// `coverage.thresholds`, because those per-project thresholds are never
// propagated to the parent process.
//
// To make the root `test:coverage` script fail when a package's threshold
// isn't met, its threshold must be mirrored here using a glob-scoped
// threshold entry (see https://vitest.dev/config/#coverage-thresholds).
// Keep this in sync with packages/domain/combat/vitest.config.ts.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        'packages/domain/combat/src/**/*.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      }
    }
  }
});
