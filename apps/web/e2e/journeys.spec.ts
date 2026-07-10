/**
 * @fileoverview One browser journey per dashboard page against the live SSE stack.
 * @layer e2e
 *
 * Each journey logs in, opens a page, and asserts that page's signature surface,
 * exercising a real round-trip where the single-instance SSE stack supports it
 * (the live feed receives a simulated event, the ticket lab mints and connects, the
 * replay lab emits a burst, the cluster lab reads a reachable instance). The pages
 * whose signature needs the WebSocket, both or multi-instance profiles (chat, both,
 * cluster fan-out across instances) assert their controls render here; their deep
 * cross-transport behavior is proven by the api e2e ws, both and cluster suites.
 */

import { expect, type Page, test } from '@playwright/test';

/** Log in as the acme admin and land on the operations board. */
async function loginAsAna(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByText('ana@acme').click();
  await expect(page).toHaveURL('/');
}

test.describe('page journeys', { tag: '@smoke' }, () => {
  test('live feed receives a simulated order event', async ({ page }) => {
    // The board opens the shared SSE connection, then a simulated burst must both
    // acknowledge and surface a real order event in the inspector. The burst is
    // emitted only after the connection badge reports "live", because the whole
    // spaced sequence completes before the POST resolves; a client that subscribed
    // late would miss every event (SSE has no replay without Last-Event-ID).
    await loginAsAna(page);
    await expect(page.getByText('Live Operations Board')).toBeVisible();
    await expect(page.getByText('live', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Simulate order burst' }).click();
    await expect(page.getByText('orders burst accepted')).toBeVisible();
    await expect(page.getByText('order.created').first()).toBeVisible({ timeout: 15_000 });
  });

  test('presence page renders the tenant roster card', async ({ page }) => {
    // The roster is scoped to the caller's own tenant, named in the card title.
    await loginAsAna(page);
    await page.goto('/presence');
    await expect(page.getByText('Presence (acme)')).toBeVisible();
  });

  test('broadcast console renders the scoped emit cards', async ({ page }) => {
    // The console offers user, tenant and room scopes; the admin also sees broadcast.
    await loginAsAna(page);
    await page.goto('/broadcast');
    await expect(page.getByText('Emit to user')).toBeVisible();
    await expect(page.getByText('Emit to tenant')).toBeVisible();
    await expect(page.getByText('Emit to room')).toBeVisible();
  });

  test('connections page renders the registry and eviction timeline', async ({ page }) => {
    // The kill-switch page pairs the live registry with the FIFO-eviction visualizer.
    await loginAsAna(page);
    await page.goto('/connections');
    await expect(page.getByText('Eviction timeline')).toBeVisible();
  });

  test('audit feed renders its feed and refresh control', async ({ page }) => {
    // The audit page shows the lifecycle feed with a manual refresh.
    await loginAsAna(page);
    await page.goto('/audit');
    await expect(page.getByText('Audit feed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('chat page renders its incident-room controls', async ({ page }) => {
    // Chat runs over WebSocket; on the SSE stack the join control still renders.
    await loginAsAna(page);
    await page.goto('/chat');
    await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible();
  });

  test('connection lab starts disconnected and connects on demand', async ({ page }) => {
    // The lab never auto-connects; clicking Connect opens a managed stream.
    await loginAsAna(page);
    await page.goto('/labs/connection');
    await expect(page.getByText('Not connected. Click Connect to open a stream.')).toBeVisible();
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('button', { name: 'Kill my stream' })).toBeEnabled();
  });

  test('ticket lab mints a one-shot ticket and connects', async ({ page }) => {
    // The lab mints a ticket on mount and opens an SSE stream authenticated with it.
    await loginAsAna(page);
    await page.goto('/labs/ticket');
    await expect(page.getByText('Ticket lab')).toBeVisible();
    await expect(page.getByText(/tickets fetched: [1-9]/)).toBeVisible();
  });

  test('replay lab emits a burst', async ({ page }) => {
    // Emitting a burst drives the replay endpoint and reports the emitted count.
    await loginAsAna(page);
    await page.goto('/labs/replay');
    await page.getByRole('button', { name: 'Emit burst' }).click();
    await expect(page.getByText(/emitted \d+ event/)).toBeVisible();
  });

  test('cluster lab reads a reachable instance', async ({ page }) => {
    // A single-instance stack still exposes the fan-out counters for the live instance.
    await loginAsAna(page);
    await page.goto('/labs/cluster');
    await expect(page.getByText('Cluster lab')).toBeVisible();
    await expect(page.getByText('instance: app-a')).toBeVisible();
  });

  test('both lab renders its split-screen panels', async ({ page }) => {
    // The both-mode lab pairs an SSE and a WebSocket panel with a shared emit.
    await loginAsAna(page);
    await page.goto('/labs/both');
    await expect(page.getByText('Both-mode lab')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emit to both' })).toBeVisible();
  });
});
