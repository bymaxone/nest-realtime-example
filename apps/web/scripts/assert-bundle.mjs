#!/usr/bin/env node
/**
 * @fileoverview Bundle-honesty gate: `socket.io-client` must never ship in the
 * statically-required (initial) chunk graph of any route.
 * @layer scripts
 *
 * The library's WebSocket branch loads `socket.io-client` via a dynamic
 * `import()`, kept out of the SSE-only static bundle by design. This script
 * runs after `next build` and empirically verifies that promise: for every
 * route, Next.js (Turbopack) emits a `page_client-reference-manifest.js` under
 * `.next/server/app/**` listing the exact `/_next/static/chunks/*.js` files
 * that route statically depends on; a dynamic `import()` is never part of that
 * list by construction, since it is resolved at runtime. This script unions
 * every route's static chunk set, asserts none of those chunk files contain the
 * string `socket.io-client`, then scans every emitted chunk under
 * `.next/static/chunks` and asserts at least one chunk outside that static set
 * does contain it - proving the dynamic import exists and is truly split out,
 * not merely absent from a broken build.
 *
 * Exits non-zero with a descriptive message on any violation.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const WEB_ROOT = path.join(import.meta.dirname, '..');
const NEXT_DIR = path.join(WEB_ROOT, '.next');
// Turbopack's production minifier drops the literal `import('socket.io-client')`
// specifier string from client output (only identifiers survive minification
// verbatim as literals, not resolved-away module specifiers), so grepping for
// the package name itself is unreliable there. `EIO=` is the engine.io-client
// handshake query parameter baked into the package's own runtime string
// literals (string literals are never renamed by a minifier), so it is a
// robust fingerprint that the real socket.io-client runtime code, not just its
// name, made it into a chunk.
const MARKER = 'EIO=';
const CHUNK_REF_PATTERN = /\/_next\/(static\/chunks\/[^"'\\]+\.js)/gu;

/** Recursively list every file under a directory. */
async function listFilesRecursive(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFilesRecursive(full) : Promise.resolve([full]);
    }),
  );
  return files.flat();
}

/** Extract every referenced `static/chunks/*.js` path from a manifest file's raw text. */
async function extractChunkRefs(manifestFile) {
  const content = await readFile(manifestFile, 'utf8');
  const refs = new Set();
  for (const match of content.matchAll(CHUNK_REF_PATTERN)) {
    const relative = match[1];
    if (relative) refs.add(relative);
  }
  return refs;
}

/** Report whether a file's contents include the marker string. */
async function fileContainsMarker(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content.includes(MARKER);
}

/** Union the statically-required chunk set across every route's manifest. */
async function collectStaticChunkSet() {
  const manifestFiles = (await listFilesRecursive(path.join(NEXT_DIR, 'server', 'app'))).filter(
    (f) => f.endsWith('_client-reference-manifest.js'),
  );
  if (manifestFiles.length === 0) {
    throw new Error(
      'no page_client-reference-manifest.js files found; did `next build` run first?',
    );
  }
  const allRefs = new Set();
  for (const manifestFile of manifestFiles) {
    for (const ref of await extractChunkRefs(manifestFile)) allRefs.add(ref);
  }
  return allRefs;
}

async function main() {
  const staticChunkRelatives = await collectStaticChunkSet();

  const violatingEntrypoints = [];
  for (const relative of staticChunkRelatives) {
    const fullPath = path.join(NEXT_DIR, relative);
    if (await fileContainsMarker(fullPath)) violatingEntrypoints.push(relative);
  }

  if (violatingEntrypoints.length > 0) {
    console.error(
      `assert-bundle: FAIL - ${MARKER} found in a statically-required chunk:\n` +
        violatingEntrypoints.map((f) => `  - ${f}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const chunksDir = path.join(NEXT_DIR, 'static', 'chunks');
  const allChunkFiles = (await listFilesRecursive(chunksDir)).filter((f) => f.endsWith('.js'));
  const staticChunkFullPaths = new Set(
    [...staticChunkRelatives].map((f) => path.join(NEXT_DIR, f)),
  );

  let foundInDynamicChunk = false;
  for (const chunkFile of allChunkFiles) {
    if (staticChunkFullPaths.has(chunkFile)) continue;
    if (await fileContainsMarker(chunkFile)) {
      foundInDynamicChunk = true;
      break;
    }
  }

  if (!foundInDynamicChunk) {
    console.error(
      `assert-bundle: FAIL - no dynamically-loaded chunk contains ${MARKER}; ` +
        'expected the chat/both-lab WebSocket branch to split it into its own chunk.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `assert-bundle: OK - ${MARKER} is absent from every route's static entrypoint ` +
      'and present in a dynamically-loaded chunk.',
  );
}

await main();
