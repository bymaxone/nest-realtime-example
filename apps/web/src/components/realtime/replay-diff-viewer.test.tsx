/**
 * @fileoverview Unit tests for {@link ReplayDiffViewer}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReplayDiffViewer } from './replay-diff-viewer';

describe('ReplayDiffViewer', () => {
  it('renders an empty state when no burst has been emitted', () => {
    // Scenario: the lab page loads before any burst has run.
    render(<ReplayDiffViewer rows={[]} />);
    expect(screen.getByText('No burst emitted yet')).toBeInTheDocument();
  });

  it('renders one chip per row, tagged with its recovery range', () => {
    // Scenario: a mixed set of live/buffer/queue/gap rows renders every tag.
    render(
      <ReplayDiffViewer
        rows={[
          { seq: 1, id: '1', tag: 'live' },
          { seq: 2, id: '2', tag: 'buffer' },
          { seq: 3, id: '3', tag: 'queue' },
          { seq: 4, id: '4', tag: 'gap' },
        ]}
      />,
    );
    expect(screen.getByText('#1 live')).toBeInTheDocument();
    expect(screen.getByText('#2 buffer')).toBeInTheDocument();
    expect(screen.getByText('#3 queue')).toBeInTheDocument();
    expect(screen.getByText('#4 gap')).toBeInTheDocument();
  });
});
