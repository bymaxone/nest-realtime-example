/**
 * @fileoverview Unit tests for the sidebar navigation table.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, navLabelFor } from './nav-items';

describe('NAV_GROUPS', () => {
  it('covers every route the spec requires, grouped into sections', () => {
    // Scenario: every realtime route is present exactly once, including the offline
    // and reauth labs, which are the only surfaces exercising the durable queue and
    // the reauthentication policy from the frontend.
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toHaveLength(13);
    expect(new Set(hrefs).size).toBe(13);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/labs/both');
    expect(hrefs).toContain('/labs/offline');
    expect(hrefs).toContain('/labs/reauth');
  });
});

describe('navLabelFor', () => {
  it('names a route that has a nav entry', () => {
    // Scenario: the shell's h1 announces the same label the nav rail highlights.
    expect(navLabelFor('/labs/both')).toBe('Both');
    expect(navLabelFor('/')).toBe('Live Feed');
  });

  it('names a route that is reachable but not in the nav', () => {
    // Scenario: login is linked from the top bar, never from the rail.
    expect(navLabelFor('/login')).toBe('Log in');
  });

  it('falls back to a generic name for an unknown route', () => {
    // Scenario: an unmapped path must still yield a heading rather than an empty one.
    expect(navLabelFor('/nope')).toBe('Dashboard');
  });
});
