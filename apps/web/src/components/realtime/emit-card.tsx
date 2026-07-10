/**
 * @fileoverview One emit-console card: target (optional) + event name + JSON payload.
 * @layer components
 *
 * Shared by the four broadcast-console scopes (user / tenant / room / broadcast).
 * Validates the event name client-side with the Zod mirror before the round
 * trip; a rejected request (e.g. the anti-IDOR 403 on a cross-tenant emit)
 * renders the api's error envelope verbatim as text, never as HTML.
 */
'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { ApiError, type AcceptedAck } from '@/lib/api-client';
import { emitFormSchema, parseEmitPayload } from '@/lib/emit-schema';

/** Props for {@link EmitCard}. */
export interface EmitCardProps {
  /** Card title, e.g. "Emit to user". */
  readonly title: string;
  /** Card description, one line. */
  readonly description: string;
  /** Label for the target field, or `undefined` when the scope has no target (broadcast). */
  readonly targetLabel?: string;
  /** Placeholder for the target field. */
  readonly targetPlaceholder?: string;
  /**
   * Submit the emit. Receives the target (empty string when the scope has none),
   * the validated event name, and the parsed payload.
   */
  readonly onSubmit: (target: string, event: string, data: unknown) => Promise<AcceptedAck>;
}

/** Feedback banner shown after a submit attempt succeeds or fails. */
type Feedback = { readonly tone: 'success' | 'error'; readonly message: string };

/** The optional target field, rendered only for scopes that have one (not broadcast). */
function TargetField({
  title,
  targetLabel,
  targetPlaceholder,
  target,
  setTarget,
}: {
  readonly title: string;
  readonly targetLabel: string | undefined;
  readonly targetPlaceholder: string | undefined;
  readonly target: string;
  readonly setTarget: (value: string) => void;
}) {
  if (!targetLabel) return null;
  return (
    <div>
      <Label htmlFor={`${title}-target`}>{targetLabel}</Label>
      <Input
        id={`${title}-target`}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder={targetPlaceholder}
        required
      />
    </div>
  );
}

/** The free-form JSON payload textarea. */
function PayloadField({
  title,
  dataText,
  setDataText,
}: {
  readonly title: string;
  readonly dataText: string;
  readonly setDataText: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={`${title}-data`}>Payload (JSON)</Label>
      <textarea
        id={`${title}-data`}
        value={dataText}
        onChange={(e) => setDataText(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-(--glass-border) bg-(--glass-bg) p-2.5 font-mono text-xs text-foreground focus:border-brand-500 focus:outline-hidden"
      />
    </div>
  );
}

/** The submit button plus the success/error feedback line below it. */
function SubmitRow({
  isPending,
  feedback,
}: {
  readonly isPending: boolean;
  readonly feedback: Feedback | null;
}) {
  return (
    <>
      <Button type="submit" disabled={isPending}>
        Emit
      </Button>
      {feedback ? (
        <p
          className={
            feedback.tone === 'success'
              ? 'text-xs text-(--color-success)'
              : 'text-xs text-(--color-danger)'
          }
        >
          {feedback.message}
        </p>
      ) : null}
    </>
  );
}

/** The target/event/payload fields plus the submit button and feedback line. */
function EmitCardFields({
  title,
  targetLabel,
  targetPlaceholder,
  target,
  setTarget,
  event,
  setEvent,
  dataText,
  setDataText,
  isPending,
  feedback,
}: {
  readonly title: string;
  readonly targetLabel: string | undefined;
  readonly targetPlaceholder: string | undefined;
  readonly target: string;
  readonly setTarget: (value: string) => void;
  readonly event: string;
  readonly setEvent: (value: string) => void;
  readonly dataText: string;
  readonly setDataText: (value: string) => void;
  readonly isPending: boolean;
  readonly feedback: Feedback | null;
}) {
  return (
    <>
      <TargetField
        title={title}
        targetLabel={targetLabel}
        targetPlaceholder={targetPlaceholder}
        target={target}
        setTarget={setTarget}
      />
      <div>
        <Label htmlFor={`${title}-event`}>Event name</Label>
        <Input
          id={`${title}-event`}
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="incident.updated"
          required
        />
      </div>
      <PayloadField title={title} dataText={dataText} setDataText={setDataText} />
      <SubmitRow isPending={isPending} feedback={feedback} />
    </>
  );
}

/** Validate, submit, and report the outcome as a {@link Feedback} value. */
async function submitEmit(
  target: string,
  event: string,
  dataText: string,
  onSubmit: EmitCardProps['onSubmit'],
): Promise<Feedback> {
  const parsed = emitFormSchema.safeParse({ event, dataText });
  if (!parsed.success) {
    return { tone: 'error', message: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }
  try {
    await onSubmit(target, parsed.data.event, parseEmitPayload(parsed.data.dataText));
    return {
      tone: 'success',
      message: 'Accepted (local echo, no server round trip needed to confirm)',
    };
  } catch (err) {
    return { tone: 'error', message: err instanceof ApiError ? err.message : 'Emit failed' };
  }
}

/** One emit-console card, shared by the user/tenant/room/broadcast scopes. */
export function EmitCard({
  title,
  description,
  targetLabel,
  targetPlaceholder,
  onSubmit,
}: EmitCardProps) {
  const [target, setTarget] = useState('');
  const [event, setEvent] = useState('');
  const [dataText, setDataText] = useState('{}');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, setPending] = useState(false);

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>): void => {
    formEvent.preventDefault();
    setPending(true);
    setFeedback(null);
    void submitEmit(target, event, dataText, onSubmit).then((result) => {
      setFeedback(result);
      setPending(false);
    });
  };

  return (
    <Card className="p-5">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <EmitCardFields
          title={title}
          targetLabel={targetLabel}
          targetPlaceholder={targetPlaceholder}
          target={target}
          setTarget={setTarget}
          event={event}
          setEvent={setEvent}
          dataText={dataText}
          setDataText={setDataText}
          isPending={isPending}
          feedback={feedback}
        />
      </form>
    </Card>
  );
}
