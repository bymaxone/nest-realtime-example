/**
 * @fileoverview Typed navigation table for the dashboard sidebar.
 * @layer components
 *
 * The eleven realtime routes are grouped into three sections (Observe /
 * Real-time / Labs) mirroring the dashboard's information architecture. Each
 * item carries its route `href` and a `lucide-react` icon; the sidebar maps
 * over these groups to render the nav rail.
 */

import {
  Cable,
  type LucideIcon,
  MessageSquare,
  Network,
  PlugZap,
  Radio,
  RefreshCw,
  ScrollText,
  Server,
  SplitSquareHorizontal,
  Ticket,
  Users,
} from 'lucide-react';

/** A single navigation entry: visible label, route, and its icon. */
export interface NavItem {
  /** Human-readable label shown in the rail. */
  readonly label: string;
  /** App Router route the item links to. */
  readonly href: string;
  /** Lucide icon rendered beside the label. */
  readonly icon: LucideIcon;
}

/** A labelled group of navigation entries. */
export interface NavGroup {
  /** Section heading (rendered uppercase). */
  readonly group: string;
  /** Entries belonging to this section. */
  readonly items: readonly NavItem[];
}

/** The grouped nav model: Observe / Real-time / Labs. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    group: 'Observe',
    items: [
      { label: 'Live Feed', href: '/', icon: Radio },
      { label: 'Broadcast', href: '/broadcast', icon: Network },
      { label: 'Audit', href: '/audit', icon: ScrollText },
    ],
  },
  {
    group: 'Real-time',
    items: [
      { label: 'Presence', href: '/presence', icon: Users },
      { label: 'Chat', href: '/chat', icon: MessageSquare },
      { label: 'Connections', href: '/connections', icon: PlugZap },
    ],
  },
  {
    group: 'Labs',
    items: [
      { label: 'Ticket', href: '/labs/ticket', icon: Ticket },
      { label: 'Connection', href: '/labs/connection', icon: Cable },
      { label: 'Replay', href: '/labs/replay', icon: RefreshCw },
      { label: 'Cluster', href: '/labs/cluster', icon: Server },
      { label: 'Both', href: '/labs/both', icon: SplitSquareHorizontal },
    ],
  },
];
