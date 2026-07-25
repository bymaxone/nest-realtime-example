/**
 * @fileoverview Demo login page: picks a seeded user and sets the session cookie.
 * @layer app
 *
 * The three demo identities are fixed by the api (`apps/api/src/auth/users.seed.ts`)
 * across two tenants, so login here is a single-field form rather than a
 * credential prompt. On success the session cookie is set by the api response and
 * this page refreshes the shared session context before navigating home.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/ui/code';
import { ApiError, authApi } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/** The demo users seeded server-side, shown as one-click login options. */
const DEMO_USERS: readonly { readonly username: string; readonly tenant: string }[] = [
  { username: 'ana@acme', tenant: 'acme (admin)' },
  { username: 'bob@acme', tenant: 'acme (member)' },
  { username: 'gil@globex', tenant: 'globex (admin)' },
];

/** Demo login page: pick a seeded user, set the session cookie. */
export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [pendingUsername, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginAs = async (username: string): Promise<void> => {
    setPending(username);
    setError(null);
    try {
      await authApi.login(username);
      await refresh();
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader accent>
          <CardTitle>Demo login</CardTitle>
          <CardDescription>
            Pick a seeded identity to set the session cookie. Every page then flows through{' '}
            <Code>withCredentials</Code> SSE, <Code>POST /auth/ticket</Code>, and{' '}
            <Code>POST /auth/ws-token</Code> from this session.
          </CardDescription>
          <div className="mt-5 flex flex-col gap-2">
            {DEMO_USERS.map((user) => (
              <Button
                key={user.username}
                variant="outline"
                disabled={pendingUsername !== null}
                onClick={() => void loginAs(user.username)}
                className="justify-between"
              >
                <span className="font-mono">{user.username}</span>
                <span className="text-white/40">{user.tenant}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-(--color-danger)">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
