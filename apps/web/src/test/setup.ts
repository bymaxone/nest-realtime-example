/**
 * @fileoverview Global Vitest setup: jest-dom matchers, RTL cleanup, Next.js navigation stubs.
 * @layer test
 *
 * `next/navigation` requires an App Router context that jsdom does not provide,
 * so every test gets a stub module by default; tests that care about a specific
 * route override `usePathname` per case with `vi.mocked`. Vitest does not inject
 * Jest-style globals, so Testing Library's automatic per-test `cleanup()` never
 * self-registers; it is wired explicitly here instead.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
}));
