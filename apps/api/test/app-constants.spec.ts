/**
 * Unit tests for the application identity constants.
 *
 * Layer: unit.
 * Goal: the hardcoded version never drifts from the package manifest.
 * Mocks: none; reads the real package.json.
 */

import packageJson from '../package.json';

import { APP_SERVICE_NAME, APP_VERSION } from '../src/app.constants';

describe('app constants', () => {
  /**
   * Drift guard.
   *
   * `APP_VERSION` is duplicated from package.json (the manifest cannot be
   * imported from src without breaking the compiler rootDir), so this test is
   * the single mechanism keeping the reported version honest.
   */
  it('keeps APP_VERSION in sync with package.json', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  /**
   * Identity check.
   *
   * The service name is surfaced in audit metadata, so it must be the stable
   * package identifier.
   */
  it('exposes the service name', () => {
    expect(APP_SERVICE_NAME).toBe('nest-realtime-example');
  });
});
