import { type Attributes, SpanStatusCode } from '@opentelemetry/api';
import { ErrorCodes, type WatchPartyPermissionMissing } from '@vp/errors';
import { getTracer } from '@vp/observability';
import type { Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';

type Failing = { readonly code: string };

const JOIN_OUTCOMES: Readonly<Record<string, string>> = {
  [ErrorCodes.WATCH_PARTY_FULL]: 'full',
  [ErrorCodes.WATCH_PARTY_GUESTS_OFF]: 'guests_off',
  [ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED]: 'password_required',
  [ErrorCodes.WATCH_PARTY_PASSWORD_INVALID]: 'password_invalid',
  [ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED]: 'locked',
  [ErrorCodes.WATCH_PARTY_BANNED]: 'banned',
  [ErrorCodes.WATCH_PARTY_CLOSED]: 'closed',
  [ErrorCodes.WATCH_PARTY_NOT_FOUND]: 'not_found',
};

const COMMAND_RESULTS: Readonly<Record<string, string>> = {
  [ErrorCodes.WATCH_PARTY_STATE_STALE]: 'stale',
  [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING]: 'forbidden',
};

/**
 * Wraps one room operation in a `watch_party.<name>` span carrying what it acted on and how it
 * ended: the failure code, or `ok`. The result is returned as it came.
 */
export async function inSpan<T, E extends Failing>(
  name: 'join' | 'command' | 'roles' | 'seat_upgrade',
  attributes: Attributes,
  run: () => Promise<Result<T, E>>
): Promise<Result<T, E>> {
  return getTracer().startActiveSpan(`watch_party.${name}`, { attributes }, async (span) => {
    try {
      const result = await run();
      span.setAttribute('result', result.ok ? 'ok' : result.error.code);
      if (!result.ok) span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.code });
      return result;
    } finally {
      span.end();
    }
  });
}

/** One join attempt counted by its outcome; a failure that is not about the room's rules is not a join outcome. */
export function countJoin<T, E extends Failing>(
  { metrics }: Pick<WatchPartyDeps, 'metrics'>,
  kind: string,
  result: Result<T, E>
): Result<T, E> {
  const outcome = result.ok ? 'joined' : JOIN_OUTCOMES[result.error.code];
  if (outcome !== undefined) metrics.watchPartyJoinsTotal.inc({ kind, outcome });
  return result;
}

/** A command counted by how it ended; a missing permission is also a denial of that permission. */
export function countCommand<T, E extends Failing>(
  { metrics }: Pick<WatchPartyDeps, 'metrics'>,
  command: string,
  result: Result<T, E>
): Result<T, E> {
  metrics.watchPartyCommandsTotal.inc({
    command,
    result: result.ok ? 'applied' : (COMMAND_RESULTS[result.error.code] ?? 'refused'),
  });
  return result;
}

export function countDenial(
  { metrics }: Pick<WatchPartyDeps, 'metrics'>,
  kind: string,
  failure: Failing
): void {
  if (failure.code === ErrorCodes.WATCH_PARTY_PERMISSION_MISSING) {
    const { permission } = failure as WatchPartyPermissionMissing;
    metrics.watchPartyPermissionDenialsTotal.inc({ permission, kind });
  }
}

/** A role change refused as an escalation, counted against the action that tried it. */
export function countRoleEscalation<T, E extends Failing>(
  { metrics }: Pick<WatchPartyDeps, 'metrics'>,
  action: string,
  result: Result<T, E>
): Result<T, E> {
  if (!result.ok && result.error.code === ErrorCodes.WATCH_PARTY_ROLE_ESCALATION) {
    metrics.watchPartyRoleChangesTotal.inc({ action, result: 'escalation' });
  }
  return result;
}
