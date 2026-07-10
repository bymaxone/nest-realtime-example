/**
 * @fileoverview Unit tests for the ticket lab page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { makeRealtime, type RealtimeFake } from '@/test-utils/realtime-mocks';

import TicketLabPage from './page';

const useRealtimeMock = vi.fn<(opts: unknown) => RealtimeFake>();
const issueTicketMock = vi.fn<() => Promise<{ ticket: string }>>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtime: (opts: unknown) => useRealtimeMock(opts),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  authApi: { issueTicket: () => issueTicketMock() },
}));

describe('TicketLabPage', () => {
  it('fetches an initial ticket on mount and connects with it', async () => {
    // Scenario: the page mints a ticket and mounts the connection with it in the URL.
    useRealtimeMock.mockReturnValue(makeRealtime({ connected: true }));
    issueTicketMock.mockResolvedValueOnce({ ticket: 'ticket-1' });
    render(<TicketLabPage />);
    await waitFor(() => expect(screen.getByText('tickets fetched: 1')).toBeInTheDocument());
    const [opts] = useRealtimeMock.mock.calls.at(-1) as [{ url: string }];
    expect(opts.url).toContain('ticket-1');
  });

  it('mints a fresh ticket on each reconnect click, proving the one-shot flow', async () => {
    // Scenario: reconnecting always fetches a brand-new ticket rather than reusing one.
    useRealtimeMock.mockReturnValue(makeRealtime());
    issueTicketMock
      .mockResolvedValueOnce({ ticket: 'ticket-1' })
      .mockResolvedValueOnce({ ticket: 'ticket-2' });
    render(<TicketLabPage />);
    await waitFor(() => expect(screen.getByText('tickets fetched: 1')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reconnect with a fresh ticket' }));
    await waitFor(() => expect(screen.getByText('tickets fetched: 2')).toBeInTheDocument());
  });

  it('shows an error when the ticket endpoint fails', async () => {
    // Scenario: the caller has no valid session, so the ticket endpoint rejects.
    useRealtimeMock.mockReturnValue(makeRealtime());
    issueTicketMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized'));
    render(<TicketLabPage />);
    expect(await screen.findByText('unauthorized')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api ticket failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useRealtimeMock.mockReturnValue(makeRealtime());
    issueTicketMock.mockRejectedValueOnce(new Error('network down'));
    render(<TicketLabPage />);
    expect(await screen.findByText('Failed to fetch a ticket')).toBeInTheDocument();
  });
});
