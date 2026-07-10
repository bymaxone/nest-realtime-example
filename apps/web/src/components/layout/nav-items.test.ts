/**
 * @fileoverview Unit tests for the sidebar navigation table.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { NAV_GROUPS } from './nav-items';

describe('NAV_GROUPS', () => {
  it('covers every route the spec requires, grouped into sections', () => {
    // Scenario: the eleven realtime routes are all present exactly once.
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toHaveLength(11);
    expect(new Set(hrefs).size).toBe(11);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/labs/both');
  });
});
