/**
 * @fileoverview Tenant broadcast console: four emit scopes plus anti-IDOR proof.
 * @layer app
 *
 * Exercises `POST /emit/user/:id`, `/tenant/:id`, `/room/:id`, and the
 * admin-only `/broadcast`. Trying the tenant card with a tenant id other than
 * the caller's own renders the api's 403 anti-IDOR envelope; the broadcast card
 * only renders for a session holding the admin role, since the api itself
 * enforces that guard.
 */
'use client';

import { EmitCard } from '@/components/realtime/emit-card';
import { emitApi } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/** Tenant broadcast console: user / tenant / room / broadcast emit scopes. */
export default function BroadcastPage() {
  const { traits } = useSession();
  const isAdmin = traits?.roles.includes('admin') ?? false;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <EmitCard
        title="Emit to user"
        description="Delivered to every connection of one user id."
        targetLabel="User ID"
        targetPlaceholder="ana@acme"
        onSubmit={(target, event, data) => emitApi.toUser(target, event, data)}
      />
      <EmitCard
        title="Emit to tenant"
        description="Only your own tenant is allowed; any other id renders the anti-IDOR 403."
        targetLabel="Tenant ID"
        targetPlaceholder={traits?.tenantId ?? 'acme'}
        onSubmit={(target, event, data) => emitApi.toTenant(target, event, data)}
      />
      <EmitCard
        title="Emit to room"
        description="Custom or resource rooms only; user/tenant scope rooms are rejected."
        targetLabel="Room ID"
        targetPlaceholder="resource:incident:1"
        onSubmit={(target, event, data) => emitApi.toRoom(target, event, data)}
      />
      {isAdmin ? (
        <EmitCard
          title="Broadcast"
          description="Admin only: delivered to every connected client, across every tenant."
          onSubmit={(_target, event, data) => emitApi.broadcast(event, data)}
        />
      ) : (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-(--glass-border) p-5 text-center text-sm text-white/40">
          Broadcast requires the admin role
        </div>
      )}
    </div>
  );
}
