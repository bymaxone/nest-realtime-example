/**
 * @fileoverview Real event ids captured from a live library burst, for the ordering spec.
 * @layer test-support
 *
 * Produced by emitting 24 events through `@bymax-one/nest-realtime` and reading
 * them back from the offline queue, in emission order. The burst deliberately
 * straddles a millisecond boundary (the counter resets from `...342-000002` to
 * `...343-000001`), which is exactly the case fixed-width zero-padding must keep
 * lexicographically ordered. Regenerate by capturing a fresh burst if the id
 * scheme ever changes.
 */

/** Event ids from one library burst, in the exact order they were emitted. */
export const CAPTURED_EVENT_IDS: readonly string[] = [
  '1783644457342-000001',
  '1783644457342-000002',
  '1783644457343-000001',
  '1783644457343-000002',
  '1783644457343-000003',
  '1783644457343-000004',
  '1783644457343-000005',
  '1783644457343-000006',
  '1783644457343-000007',
  '1783644457343-000008',
  '1783644457343-000009',
  '1783644457343-000010',
  '1783644457343-000011',
  '1783644457343-000012',
  '1783644457343-000013',
  '1783644457343-000014',
  '1783644457343-000015',
  '1783644457343-000016',
  '1783644457343-000017',
  '1783644457343-000018',
  '1783644457343-000019',
  '1783644457343-000020',
  '1783644457343-000021',
  '1783644457343-000022',
];
