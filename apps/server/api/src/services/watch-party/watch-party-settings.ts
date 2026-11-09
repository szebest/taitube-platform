import type { PatchWatchPartyBody, WatchPartyView } from '@vp/api-contracts';
import type { HashingFailed } from '@vp/core/ports';
import type { RoomWrite, SettingsPatch } from '@vp/core/repositories';
import type { WatchPartyCloseReason, WatchPartyPermission, WatchPartyRoom } from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  type WatchPartyPermissionMissing,
  versionConflict,
  watchPartyClosed,
  watchPartyNotFound,
} from '@vp/errors';
import { andThenAsync, assertNever, err, isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, logChange, systemLineFor } from './watch-party-moderation-effects';
import { requirePrincipal, type Unauthenticated } from './watch-party-principals';
import { checkRoomInput, type InvalidRoomInput } from './watch-party-room-input';
import { presentRoom } from './watch-party-room-views';

type RoomOutcome<T> = Result<
  T,
  | Unauthenticated
  | WatchPartyNotFound
  | WatchPartyPermissionMissing
  | WatchPartyClosed
  | DatabaseUnavailable
>;

async function openRoomFor(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  action: string,
  needs: readonly WatchPartyPermission[]
): Promise<RoomOutcome<{ context: RoomContext; actorKey: string }>> {
  const principal = requirePrincipal(caller, action);
  if (isErr(principal)) return principal;
  const loaded = await deps.context.load(roomId, caller);
  return andThenAsync(
    loaded,
    (context): RoomOutcome<{ context: RoomContext; actorKey: string }> => {
      for (const permission of needs) {
        const held = requireRoomPermission(context.ability, permission);
        if (isErr(held)) return held;
      }
      if (context.room.status === 'closed') return err(watchPartyClosed(roomId));
      return context.memberKey === null
        ? err(watchPartyNotFound(roomId))
        : ok({ context, actorKey: context.memberKey });
    }
  );
}

function patchOf(
  body: PatchWatchPartyBody,
  checked: {
    name: string | undefined;
    capacity: number | null | undefined;
    scheduledFor: Date | null | undefined;
  },
  passwordHash: string | null | undefined
): SettingsPatch {
  return {
    name: checked.name,
    visibility: body.visibility,
    capacity: checked.capacity,
    allowGuests: body.allowGuests,
    chatEnabled: body.chatEnabled,
    slowModeSeconds: body.slowModeSeconds,
    bufferPolicy: body.bufferPolicy,
    autoplay: body.autoplay,
    skipVotePercent: body.skipVotePercent,
    idleClose: body.idleClose,
    language: body.language,
    accent: body.accent,
    scheduledFor: checked.scheduledFor,
    autoStart: body.autoStart,
    passwordHash,
  };
}

function appliedRoom(
  write: RoomWrite,
  roomId: string,
  expectedVersion: number
): Result<WatchPartyRoom, VersionConflict | WatchPartyNotFound> {
  switch (write.type) {
    case 'applied':
      return ok(write.room);
    case 'stale':
      return err(versionConflict(roomId, expectedVersion));
    case 'missing':
      return err(watchPartyNotFound(roomId));
    default:
      return assertNever(write, 'RoomWrite');
  }
}

export type UpdateFailure =
  | InvalidRoomInput
  | HashingFailed
  | VersionConflict
  | Unauthenticated
  | WatchPartyNotFound
  | WatchPartyPermissionMissing
  | WatchPartyClosed
  | DatabaseUnavailable;

export async function updateRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  body: PatchWatchPartyBody
): Promise<Result<WatchPartyView, UpdateFailure>> {
  const reschedules = body.scheduledFor !== undefined || body.autoStart !== undefined;
  const opened = await openRoomFor(
    deps,
    roomId,
    caller,
    'edit a watch party',
    reschedules ? ['room.edit', 'room.schedule'] : ['room.edit']
  );
  if (isErr(opened)) return opened;
  const { context, actorKey } = opened.value;

  const checked = checkRoomInput(body, { ceiling: deps.config.maxMembers, now: deps.now() });
  if (isErr(checked)) return checked;
  const { password } = checked.value;
  const passwordHash =
    typeof password === 'string' ? await deps.hasher.hash(password) : ok(password);
  if (isErr(passwordHash)) return passwordHash;

  const written = await deps.repositories.watchPartyRooms.updateSettings(
    roomId,
    patchOf(body, checked.value, passwordHash.value),
    body.version,
    systemLineFor(deps, context.room, {
      event: 'settings_changed',
      actorKey,
      targetKey: null,
      detail: null,
    }),
    deps.now()
  );
  if (isErr(written)) return written;
  const applied = appliedRoom(written.value, roomId, body.version);
  if (isErr(applied)) return applied;

  const view = await presentRoom(deps, applied.value);
  if (isErr(view)) return view;
  await announce(deps, roomId, { type: 'settings', room: view.value });
  logChange(deps, { roomId, actorKey, action: 'settings' });
  return view;
}

function closeReasonOf({ isOwner }: RoomContext): WatchPartyCloseReason {
  return isOwner ? 'owner' : 'moderator';
}

export async function closeRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller
): Promise<RoomOutcome<WatchPartyView>> {
  const opened = await openRoomFor(deps, roomId, caller, 'close a watch party', ['room.close']);
  if (isErr(opened)) return opened;
  const { context, actorKey } = opened.value;
  const reason = closeReasonOf(context);

  const written = await deps.repositories.watchPartyRooms.close(roomId, reason, null, deps.now());
  if (isErr(written)) return written;
  switch (written.value.type) {
    case 'applied': {
      const view = await presentRoom(deps, written.value.room);
      if (isErr(view)) return view;
      await announce(deps, roomId, { type: 'closed', reason });
      logChange(deps, { roomId, actorKey, action: 'close' });
      return view;
    }
    case 'stale':
      return err(watchPartyClosed(roomId));
    case 'missing':
      return err(watchPartyNotFound(roomId));
    default:
      return assertNever(written.value, 'RoomWrite');
  }
}
