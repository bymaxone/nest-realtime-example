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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { ApiError, type AcceptedAck } from '@/lib/api-client';
import { emitFormSchema, parseEmitPayload } from '@/lib/emit-schema';
import { cn } from '@/lib/utils';

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

/**
 * Derive a valid HTML `id` prefix from a card title.
 *
 * Titles are prose ("Emit to user"), and an `id` may not contain whitespace, so
 * interpolating one directly produced ids that no selector could address.
 *
 * @param title - The card title.
 * @returns A lowercase, hyphenated prefix safe to use in `id` and `htmlFor`.
 */
function fieldPrefix(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/(^-|-$)/gu, '');
}

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
      <Label htmlFor={`${fieldPrefix(title)}-target`}>{targetLabel}</Label>
      <Input
        id={`${fieldPrefix(title)}-target`}
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
      <Label htmlFor={`${fieldPrefix(title)}-data`}>Payload (JSON)</Label>
      <textarea
        id={`${fieldPrefix(title)}-data`}
        value={dataText}
        onChange={(e) => setDataText(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-(--glass-border) bg-(--glass-bg) p-2.5 font-mono text-xs text-foreground focus:border-brand-500 focus:outline-hidden"
      />
    </div>
  );
}

/**
 * The submit button plus the success/error feedback line below it.
 *
 * Lives in the card footer, which the form pins to the bottom of the stretched
 * card, so the Emit buttons of a grid row line up even when one scope has one
 * field fewer. The feedback line always occupies its height so a result never
 * shifts the layout.
 */
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
      <p
        aria-live="polite"
        className={cn(
          'min-h-4 text-xs',
          feedback?.tone === 'success' && 'text-(--color-success)',
          feedback?.tone === 'error' && 'text-(--color-danger)',
        )}
      >
        {feedback?.message ?? ''}
      </p>
    </>
  );
}

/** The target, event-name and payload fields of one emit scope. */
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
        <Label htmlFor={`${fieldPrefix(title)}-event`}>Event name</Label>
        <Input
          id={`${fieldPrefix(title)}-event`}
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="incident.updated"
          required
        />
      </div>
      <PayloadField title={title} dataText={dataText} setDataText={setDataText} />
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
    return { tone: 'success', message: 'Accepted by the api; watch the live feed for delivery.' };
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
    // The card stretches to its grid row; making it a column with a growing form
    // is what keeps the field rows and the Emit buttons aligned across the row,
    // whatever length each scope's description happens to be.
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="min-h-10">{description}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <CardContent className="flex flex-col gap-3">
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
          />
        </CardContent>
        <CardFooter className="mt-auto flex-col items-stretch gap-2">
          <SubmitRow isPending={isPending} feedback={feedback} />
        </CardFooter>
      </form>
    </Card>
  );
}
