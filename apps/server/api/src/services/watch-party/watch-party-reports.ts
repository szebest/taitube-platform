import { err, isErr, ok, type Result } from '@kit/result';
import type { ReportWatchPartyBody } from '@vp/api-contracts';
import { memberKeyOf, REPORTS_TO_HIDE_ROOM } from '@vp/domain';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyAlreadyReported,
  type WatchPartyNotFound,
  watchPartyAlreadyReported,
  watchPartyNotFound,
} from '@vp/errors';
import { canReportWatchParty } from '@vp/permissions';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { logChange } from './watch-party-moderation-effects';
import { type PreviewFailure, roomAccessOf } from './watch-party-preview';

export type ReportFailure =
  | AuthorizationFailure
  | PreviewFailure
  | WatchPartyAlreadyReported
  | DatabaseUnavailable;

/** Signed-in accounts report a public room or one they are in; three open room reports hide it. */
export async function reportRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  body: ReportWatchPartyBody
): Promise<Result<{ id: string }, ReportFailure | WatchPartyNotFound>> {
  const { repositories, metrics, secrets, now } = deps;
  const signedIn = authorize(caller.user, true, { action: 'report', subject: 'WatchParty' });
  if (isErr(signedIn)) return signedIn;
  const reporter = signedIn.value;

  const loaded = await deps.context.load(roomId, caller);
  if (isErr(loaded)) return loaded;
  const { room } = loaded.value;
  const access = await roomAccessOf(deps, loaded.value, undefined);
  if (isErr(access)) return access;
  const allowed = authorize(
    caller.user,
    canReportWatchParty(caller.user, {
      visibility: room.visibility,
      isMember: access.value.isMember,
    }),
    { action: 'report', subject: 'WatchParty' }
  );
  if (isErr(allowed)) return allowed;

  const targetKey = body.targetKey ?? null;
  if (targetKey !== null) {
    const seat = await repositories.watchPartyMembers.find(roomId, targetKey);
    if (isErr(seat)) return seat;
    if (seat.value === null) return err(watchPartyNotFound(roomId));
  }

  const at = now();
  const id = secrets.newId();
  const filed = await repositories.watchPartyReports.file(
    {
      id,
      roomId,
      reporterId: reporter.id,
      targetKey,
      context: body.context,
      reason: body.reason,
      details: body.details ?? null,
      createdAt: at,
    },
    REPORTS_TO_HIDE_ROOM,
    at
  );
  if (isErr(filed)) return filed;
  if (filed.value.type === 'duplicate') {
    metrics.watchPartyReportsTotal.inc({ outcome: 'duplicate' });
    return err(watchPartyAlreadyReported(roomId));
  }
  metrics.watchPartyReportsTotal.inc({ outcome: filed.value.hidden ? 'hidden' : 'filed' });
  logChange(deps, {
    roomId,
    actorKey: memberKeyOf({ kind: 'user', userId: reporter.id }),
    action: filed.value.hidden ? 'report.hide' : 'report',
    targetKey,
  });
  return ok({ id });
}
