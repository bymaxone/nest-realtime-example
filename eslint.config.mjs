// @ts-check

/**
 * @fileoverview Root ESLint flat configuration for the nest-realtime-example workspace.
 * @layer config
 *
 * Applies strict typed linting to both apps and enforces the two invariants that keep
 * the example honest: a banned-import list (stdlib/library alternatives exist for every
 * banned package) and the frontend/backend subpath boundary (apps/web may only reach the
 * library's `/react` and `/shared` subpaths; apps/api may never import `/react`).
 */

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

/**
 * Third-party packages banned workspace-wide because a stdlib or in-house alternative
 * covers the same need without adding a dependency (standards §0 simplicity ladder).
 */
const BANNED_IMPORTS = [
  { name: 'axios', message: 'Use the built-in fetch API instead.' },
  { name: 'bcrypt', message: 'Use node:crypto or argon2 via the project hashing service instead.' },
  { name: 'jsonwebtoken', message: 'Use the sanctioned session/ticket primitives instead.' },
  { name: 'moment', message: 'Use the Intl API or a native Date utility instead.' },
  { name: 'lodash', message: 'Use native JavaScript/TypeScript utilities instead.' },
  { name: 'uuid', message: 'Use crypto.randomUUID() instead.' },
  { name: 'passport', message: 'Use the library IConnectionAuthenticator contract instead.' },
  { name: 'dotenv', message: 'Environment loading is handled by the typed config module.' },
];

export default defineConfig([
  globalIgnores(['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**']),
  js.configs.recommended,
  {
    // Plain Node scripts and build config files (next.config.mjs, assert-bundle.mjs, ...):
    // no TypeScript project, so they only need the runtime globals Node provides.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    // Real application source: typed linting against each app's own tsconfig.
    files: ['apps/*/src/**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      // An explicit project glob keeps tsconfig discovery correct regardless of the
      // invoking process's cwd (e.g. a repo-root git hook vs. a per-package script);
      // the resolver's cwd-based default lookup finds nothing since no tsconfig.json
      // lives at the workspace root (only the shared `tsconfig.base.json`).
      'import-x/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json'],
        },
      },
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Mirror the tsconfig `noUnusedParameters` convention: a leading underscore
      // marks a parameter required by a contract signature but intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Tooling config files (vitest.config.ts, etc.): syntax-level typed rules only,
    // since these live outside each app's tsconfig "include" and have no project to type-check against.
    files: ['**/*.{ts,tsx}'],
    ignores: ['apps/*/src/**'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...BANNED_IMPORTS,
            {
              name: '@bymax-one/nest-realtime',
              message: "apps/web may only import '@bymax-one/nest-realtime/react' or '/shared'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...BANNED_IMPORTS,
            {
              name: '@bymax-one/nest-realtime/react',
              message: 'apps/api must never import the /react subpath.',
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
]);
