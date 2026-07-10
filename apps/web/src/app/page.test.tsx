/**
 * @fileoverview Unit tests for the Live Operations Board page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import LiveFeedPage from './page';

interface MockContextValue {
  readonly events: ReadonlyArray<{ type: string; data: unknown; id?: string }>;
}

const useRealtimeContextMock = vi.fn<() => MockContextValue>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeContext: () => useRealtimeContextMock(),
}));

const simulateOrdersMock = vi.fn<() => Promise<{ simulated: string }>>();
const simulateDeploymentsMock = vi.fn<() => Promise<{ simulated: string }>>();

vi.mock('@/lib/api-client', () => ({
  ApiError,
  domainApi: {
    simulateOrders: () => simulateOrdersMock(),
    simulateDeployments: () => simulateDeploymentsMock(),
  },
}));

describe('LiveFeedPage', () => {
  it('renders the shared connection events newest-first in the inspector', () => {
    // Scenario: two order events already arrived on the shared connection.
    useRealtimeContextMock.mockReturnValue({
      events: [
        { type: 'order.created', data: { orderId: '1', status: 'created' }, id: '1' },
        { type: 'order.paid', data: { orderId: '1', status: 'paid' }, id: '2' },
      ],
    });
    render(<LiveFeedPage />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('order.paid');
  });

  it('simulates an order burst and shows an accepted status', async () => {
    // Scenario: clicking the simulate button drives POST /domain/orders/simulate.
    useRealtimeContextMock.mockReturnValue({ events: [] });
    simulateOrdersMock.mockResolvedValueOnce({ simulated: 'orders' });
    render(<LiveFeedPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Simulate order burst' }));
    expect(await screen.findByText('orders burst accepted')).toBeInTheDocument();
  });

  it('simulates a deployment burst and surfaces the api failure message', async () => {
    // Scenario: the deployment simulate call fails with an ApiError.
    useRealtimeContextMock.mockReturnValue({ events: [] });
    simulateDeploymentsMock.mockRejectedValueOnce(new ApiError(500, 'internal error'));
    render(<LiveFeedPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Simulate deployment burst' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('surfaces a generic failure message for a non-api error', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useRealtimeContextMock.mockReturnValue({ events: [] });
    simulateOrdersMock.mockRejectedValueOnce(new Error('network down'));
    render(<LiveFeedPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Simulate order burst' }));
    expect(await screen.findByText('Simulation failed')).toBeInTheDocument();
  });
});
