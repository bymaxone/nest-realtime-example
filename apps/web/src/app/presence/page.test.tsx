/**
 * @fileoverview Unit tests for the presence roster page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { makePresence, type PresenceFake } from '@/test-utils/realtime-mocks';

import PresencePage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

const usePresenceMock = vi.fn<() => PresenceFake>();
const useSessionMock = vi.fn<() => MockSessionValue>();
const rosterMock =
  vi.fn<(tenantId: string) => Promise<{ tenantId: string; online: readonly string[] }>>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  usePresence: () => usePresenceMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  presenceApi: { roster: (tenantId: string) => rosterMock(tenantId) },
}));

describe('PresencePage', () => {
  it('merges the REST-seeded roster with live presence updates', async () => {
    // Scenario: the REST snapshot already lists one user; the hook adds another live.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    usePresenceMock.mockReturnValue(makePresence({ onlineUserIds: ['bob@acme'], count: 1 }));
    rosterMock.mockResolvedValue({ tenantId: 'acme', online: ['ana@acme'] });
    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();
    expect(screen.getByText('bob@acme')).toBeInTheDocument();
    expect(screen.getByText('Presence (acme)')).toBeInTheDocument();
  });

  it('renders an empty state when no one is online and there is no session yet', () => {
    // Scenario: the page renders before the session lookup resolves.
    useSessionMock.mockReturnValue({ traits: null });
    usePresenceMock.mockReturnValue(makePresence());
    render(<PresencePage />);
    expect(screen.getByText('No one online yet')).toBeInTheDocument();
  });

  it('shows an error when the roster fetch fails', async () => {
    // Scenario: the presence REST endpoint is unreachable.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    usePresenceMock.mockReturnValue(makePresence());
    rosterMock.mockRejectedValue(new ApiError(500, 'internal error'));
    render(<PresencePage />);
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api roster failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    usePresenceMock.mockReturnValue(makePresence());
    rosterMock.mockRejectedValue(new Error('network down'));
    render(<PresencePage />);
    expect(await screen.findByText('Failed to load the roster')).toBeInTheDocument();
  });
});
