/**
 * @fileoverview Next.js configuration for apps/web.
 * @layer config
 *
 * Security headers are applied globally. The CSP allows same-origin resources
 * and permits `unsafe-inline` for RSC streaming / React hydration. The dashboard
 * talks to the NestJS api over REST and SSE (`NEXT_PUBLIC_API_URL`) and receives
 * live chat events over a Socket.IO WebSocket (`NEXT_PUBLIC_WS_URL`), so both the
 * HTTP origin and its `ws`/`wss` variant must appear in `connect-src`.
 * `frame-ancestors 'none'` blocks clickjacking, `object-src 'none'` forbids
 * plugin/embed vectors, and `base-uri 'self'` pins `<base>`; HSTS is enabled in
 * production only.
 *
 * Linting is centralized at the workspace root (`eslint .`); Next 16 no longer
 * runs ESLint during the build, so no per-build lint configuration is needed.
 */

import path from 'node:path';
import process from 'node:process';

const isProduction = process.env['NODE_ENV'] === 'production';

const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const wsBase = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001';

/**
 * Derive the bare origin from a URL string, returning `''` when it cannot be parsed.
 *
 * @param {string} value - A candidate absolute URL.
 * @returns {string} The origin (scheme + host + port) or an empty string.
 */
function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

const apiOrigin = originOf(apiBase);
const wsOrigin = originOf(wsBase);
// The WebSocket URL may already use ws(s):// (see NEXT_PUBLIC_WS_URL); derive the
// matching http(s) origin too since the ticket/ws-token REST calls share it.
const wsHttpOrigin = wsOrigin.replace(/^ws/, 'http');
const wsWsOrigin = wsOrigin.startsWith('ws') ? wsOrigin : wsOrigin.replace(/^http/, 'ws');

// De-duplicate: when the api and WS URLs share an origin the entry would repeat.
const connectSrc = [
  ...new Set(["'self'", apiOrigin, wsHttpOrigin, wsWsOrigin].filter(Boolean)),
].join(' ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not advertise the framework - drops the `X-Powered-By: Next.js` response header.
  poweredByHeader: false,
  logging: {
    // Don't forward the browser console to the dev-server terminal; keeps local
    // dev output focused on server-side logs only.
    browserToTerminal: false,
  },
  // Emit a self-contained server bundle so a production image ships only the
  // traced runtime. outputFileTracingRoot points at the monorepo root so pnpm's
  // workspace dependencies are traced into the standalone output.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // React's development build uses eval() for its debugging features
              // (rebuilding stack frames across environments). Production never
              // does, so the allowance is scoped to the dev server only.
              `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          ...(isProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
