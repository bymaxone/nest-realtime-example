/**
 * @fileoverview Resolution probe for the linked @bymax-one/nest-realtime package.
 * @layer test
 *
 * Proves that this NestJS (CommonJS) consumer can load the library's server `.`
 * and zero-dependency `./shared` subpaths, that the room-id helper behaves as
 * documented, and that every published subpath ships both an ESM and a CommonJS
 * build. The React `./react` subpath and native ESM loading are proven by the
 * web app's own probe, which runs under an ESM-native test runner.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { BymaxRealtimeModule, RealtimeService, composeRoomId } from '@bymax-one/nest-realtime';
import { RESERVED_EVENT_NAMES, ROOM_PREFIXES } from '@bymax-one/nest-realtime/shared';

const requireFromHere = createRequire(__filename);

/** The `import`, `require` and `types` targets a subpath export declares. */
interface ConditionalExport {
  readonly import: string;
  readonly require: string;
  readonly types: string;
}

/** The manifest fields this probe inspects. */
interface LibraryManifest {
  readonly name: string;
  readonly exports: Record<string, ConditionalExport | undefined>;
}

/**
 * Walk up from a resolved module file to the directory whose package.json names
 * the library. The manifest itself is not an exported subpath, so it cannot be
 * required directly through the package's `exports` map.
 */
function findLibraryRoot(fromFile: string): string {
  let dir = dirname(fromFile);
  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = resolve(dir, 'package.json');
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Partial<LibraryManifest>;
      if (parsed.name === '@bymax-one/nest-realtime') {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('could not locate the @bymax-one/nest-realtime package root');
}

describe('@bymax-one/nest-realtime subpath resolution', () => {
  it('exposes the server module and service through the root subpath', () => {
    // Scenario: a NestJS consumer imports the dynamic module and the service
    // from '.'; both must be constructable classes with the documented statics.
    expect(typeof BymaxRealtimeModule.forRoot).toBe('function');
    expect(typeof BymaxRealtimeModule.forRootAsync).toBe('function');
    expect(typeof RealtimeService).toBe('function');
  });

  it('resolves the identical root exports through an explicit CommonJS require', () => {
    // Scenario: the `require` export condition returns the same symbols as the
    // consumer-style import above, proving the '.' subpath is a single package.
    const root = requireFromHere('@bymax-one/nest-realtime') as {
      BymaxRealtimeModule: typeof BymaxRealtimeModule;
      RealtimeService: typeof RealtimeService;
    };
    expect(root.BymaxRealtimeModule).toBe(BymaxRealtimeModule);
    expect(root.RealtimeService).toBe(RealtimeService);
  });

  it('exposes the reserved event names and room prefixes through the shared subpath', () => {
    // Scenario: the zero-dependency './shared' subpath carries the constants both
    // apps share. They are compile-time readonly rather than runtime-frozen, so
    // the probe asserts their documented values.
    expect(RESERVED_EVENT_NAMES.CONNECTION_ESTABLISHED).toBe('connection:established');
    expect(RESERVED_EVENT_NAMES.ERROR).toBe('error');
    expect(ROOM_PREFIXES.USER).toBe('user');
    expect(ROOM_PREFIXES.TENANT).toBe('tenant');
    expect(ROOM_PREFIXES.RESOURCE).toBe('resource');
  });

  it('composes canonical room ids through the library helper', () => {
    // Scenario: composeRoomId joins a prefix and its parts with ':'. The helper
    // ships from the server subpath, so the api imports it from '.' rather than
    // './shared'.
    expect(composeRoomId('RESOURCE', 'incident', 'i1')).toBe('resource:incident:i1');
    expect(composeRoomId('USER', 'u1')).toBe('user:u1');
  });

  it('ships an ESM and a CommonJS build for every published subpath', () => {
    // Scenario: the dual-format package must resolve for both ESM and CommonJS
    // consumers, so each subpath declares an `import`, a `require` and a `types`
    // target, and every declared target file exists on disk.
    const packageRoot = findLibraryRoot(requireFromHere.resolve('@bymax-one/nest-realtime'));
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as LibraryManifest;

    for (const subpath of ['.', './shared', './react']) {
      const entry = manifest.exports[subpath];
      if (entry === undefined) {
        throw new Error(`missing export map entry for subpath ${subpath}`);
      }
      for (const target of [entry.import, entry.require, entry.types]) {
        expect(existsSync(resolve(packageRoot, target))).toBe(true);
      }
    }
  });
});
