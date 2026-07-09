/**
 * @fileoverview Jest unit configuration for the api workspace package.
 * @layer config
 *
 * maxWorkers is capped at 50% of available cores as a memory-safety guard: the
 * library under test is consumed via a local link, so every worker would
 * otherwise load its own copy of the compiled module graph.
 *
 * Coverage is collected on every run and pinned to 100% so any shipped source
 * file stays fully exercised. The package entry point and the process bootstrap
 * are excluded because they wire the live server, which end-to-end runs prove
 * rather than unit coverage; spec files are excluded from their own report.
 *
 * SWC transpiles the TypeScript and emits NestJS-compatible decorator metadata.
 * Unlike ts-jest's per-file transpile, it emits the plain `design:paramtypes`
 * array rather than a guarded form, so injected class dependencies never create
 * unreachable coverage branches. `keepClassNames` preserves the class names
 * NestJS uses as DI tokens.
 */

import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
          keepClassNames: true,
        },
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  maxWorkers: '50%',
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/main.ts', '!src/**/*.spec.ts'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};

export default config;
