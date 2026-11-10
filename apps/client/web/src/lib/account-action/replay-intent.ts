import { ignore, isOk, tryCatch } from '@vp/result';
import { z } from 'zod';

const STORAGE_KEY = 'vp.replay';
const STALE_AFTER_MS = 10 * 60 * 1000;

const IntentSchema = z.object({ kind: z.enum(['like', 'subscribe', 'save']), id: z.uuid() });

/** An action that is safe to run twice, so signing in can carry on from where the viewer pressed. */
export type ReplayIntent = z.infer<typeof IntentSchema>;

export const encodeIntent = ({ kind, id }: ReplayIntent): string => `${kind}:${id}`;

export function decodeIntent(raw: string | undefined): ReplayIntent | undefined {
  const [kind, id] = raw?.split(':') ?? [];
  const parsed = IntentSchema.safeParse({ kind, id });
  return parsed.success ? parsed.data : undefined;
}

const StoredSchema = z.object({ intent: IntentSchema, at: z.number() });

export function rememberIntent(intent: ReplayIntent): void {
  ignore(
    tryCatch(
      () => window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ intent, at: Date.now() })),
      (cause) => cause
    ),
    'blocked storage means no replay, and the viewer presses the action again'
  );
}

export function forgetIntent(): void {
  ignore(
    tryCatch(
      () => window.sessionStorage.removeItem(STORAGE_KEY),
      (cause) => cause
    ),
    'blocked storage holds nothing to forget'
  );
}

/** What storage holds for the intent, as the text it was written in, so a store can compare it. */
export function rawIntent(): string | null {
  const raw = tryCatch(
    () => window.sessionStorage.getItem(STORAGE_KEY),
    (cause) => cause
  );
  return isOk(raw) ? raw.value : null;
}

/** The intent in `raw`, unless it is damaged or older than ten minutes. */
export function intentIn(raw: string | null): ReplayIntent | undefined {
  if (raw === null) return undefined;
  const json = tryCatch(
    (): unknown => JSON.parse(raw),
    (cause) => cause
  );
  const stored = isOk(json) ? StoredSchema.safeParse(json.value) : undefined;
  return stored?.success && Date.now() - stored.data.at <= STALE_AFTER_MS
    ? stored.data.intent
    : undefined;
}

/** The remembered intent, once: it is gone after this read. */
export function takeIntent(): ReplayIntent | undefined {
  const intent = intentIn(rawIntent());
  forgetIntent();
  return intent;
}
