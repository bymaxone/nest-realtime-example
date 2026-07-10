/**
 * @fileoverview Smoke journey: log in, then open every route in the app.
 * @layer e2e
 *
 * Runs against a live api (redis required) and a live `next dev`/`next start`
 * web server. Each route is asserted to render the shell (topbar wordmark)
 * without a Next.js error overlay, proving the App Router skeleton, the
 * shared `RealtimeProvider`, and every page mount cleanly end to end.
 */

import { expect, test } from '@playwright/test';

/** Every route the sidebar links to, plus the ones reachable only from the shell. */
const ROUTES: readonly string[] = [
  '/',
  '/broadcast',
  '/audit',
  '/presence',
  '/chat',
  '/connections',
  '/labs/ticket',
  '/labs/connection',
  '/labs/replay',
  '/labs/cluster',
  '/labs/both',
];

test.describe('smoke journey', () => {
  test('logs in and opens every page without an error overlay', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('ana@acme').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('header').getByText('nest-realtime-example')).toBeVisible();

    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator('header').getByText('nest-realtime-example')).toBeVisible();
      await expect(page.getByText('Application error')).toHaveCount(0);
    }
  });
});
