/**
 * @fileoverview Jest configuration Stryker drives for the api mutation run.
 * @layer config
 *
 * Mirrors the unit transform and test match of `jest.config.ts` but collects no
 * coverage and enforces no coverage threshold: Stryker measures how many mutants
 * the unit suite kills, not line coverage, and Stryker runs the suite hundreds of
 * times, so coverage instrumentation would only slow it. Only unit specs
 * (`*.spec.ts`) run; the `*.e2e-spec.ts` suites need a live server and Redis and
 * are excluded, exactly as in the unit run.
 */

module.exports = {
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
  maxWorkers: 1,
};
