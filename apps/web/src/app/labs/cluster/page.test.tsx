/**
 * @fileoverview Unit tests for the cluster lab page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ClusterLabPage from './page';

const simulateOrdersMock = vi.fn<() => Promise<{ simulated: string }>>();

vi.mock('@/lib/api-client', () => ({
  ApiError,
  domainApi: { simulateOrders: () => simulateOrdersMock() },
}));

/** Build a minimal successful fetch Response stub. */
function okResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

type FetchMock = ReturnType<typeof vi.fn<(url: string) => Promise<Response>>>;

describe('ClusterLabPage', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('polls both instance ports and renders their stats', async () => {
    // Scenario: both cluster instances are reachable and report their counters.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        okResponse({
          instance: url.includes('3001') ? 'app-a' : 'app-b',
          published: 1,
          receivedRemote: 0,
          deliveredLocal: 1,
        }),
      ),
    );
    render(<ClusterLabPage />);
    expect(await screen.findByText('instance: app-a')).toBeInTheDocument();
    expect(await screen.findByText('instance: app-b')).toBeInTheDocument();
  });

  it('shows an unreachable state for an instance that fails or errors', async () => {
    // Scenario: only the cluster profile's first port is reachable in this test.
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('3001')) {
        return Promise.resolve(
          okResponse({ instance: 'app-a', published: 0, receivedRemote: 0, deliveredLocal: 0 }),
        );
      }
      return Promise.reject(new Error('connection refused'));
    });
    render(<ClusterLabPage />);
    expect(await screen.findByText('instance: app-a')).toBeInTheDocument();
    expect(await screen.findAllByText('unreachable (cluster profile not running)')).toHaveLength(1);
  });

  it('reports a non-ok response as unreachable too', async () => {
    // Scenario: the instance answers but with a non-2xx status.
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    render(<ClusterLabPage />);
    expect(await screen.findAllByText('unreachable (cluster profile not running)')).toHaveLength(2);
  });

  it('triggers a tenant fan-out and shows a status message', async () => {
    // Scenario: the demo button drives the domain simulator.
    fetchMock.mockResolvedValue(
      okResponse({ instance: 'app-a', published: 0, receivedRemote: 0, deliveredLocal: 0 }),
    );
    simulateOrdersMock.mockResolvedValueOnce({ simulated: 'orders' });
    render(<ClusterLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Trigger tenant fan-out' }));
    expect(await screen.findByText(/watch published\/receivedRemote update/)).toBeInTheDocument();
  });

  it('shows a failure message when the fan-out trigger fails', async () => {
    // Scenario: the domain simulate call is rejected.
    fetchMock.mockResolvedValue(
      okResponse({ instance: 'app-a', published: 0, receivedRemote: 0, deliveredLocal: 0 }),
    );
    simulateOrdersMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized'));
    render(<ClusterLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Trigger tenant fan-out' }));
    expect(await screen.findByText('unauthorized')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api fan-out failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    fetchMock.mockResolvedValue(
      okResponse({ instance: 'app-a', published: 0, receivedRemote: 0, deliveredLocal: 0 }),
    );
    simulateOrdersMock.mockRejectedValueOnce(new Error('network down'));
    render(<ClusterLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Trigger tenant fan-out' }));
    expect(await screen.findByText('Failed to trigger fan-out')).toBeInTheDocument();
  });

  it('polls again after the interval elapses', async () => {
    // Scenario: the page re-polls on a fixed interval without user action.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValue(
      okResponse({ instance: 'app-a', published: 0, receivedRemote: 0, deliveredLocal: 0 }),
    );
    render(<ClusterLabPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBefore = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3100);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    vi.useRealTimers();
  });
});
