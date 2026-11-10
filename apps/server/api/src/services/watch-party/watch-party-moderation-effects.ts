import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { NewSystemLine, RoleWrite } from '@vp/core/repositories';
import {
  expectedPositionMs,
  type WatchPartyRoleRecord,
  type WatchPartyRoom,
  type WatchPartySystemEvent,
} from '@vp/domain';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  type WatchPartyNotFound,
  versionConflict,
  watchPartyNotFound,
} from '@vp/errors';
import { assertNever, err, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { memberRolesFrame, toRoleView } from './watch-party-role-views';

type Effects = Pick<
  WatchPartyDeps,
  'broadcaster' | 'logger' | 'metrics' | 'now' | 'secrets' | 'repositories'
>;

const ROLE_CHANGES = {
  'role.create': 'create',
  'role.update': 'update',
  'role.delete': 'delete',
  'role.assign': 'assign',
  'role.revoke': 'revoke',
  'role.preset': 'preset',
  'owner.transfer': 'transfer',
  'owner.grace': 'transfer',
} as const satisfies Record<string, string>;

export interface ChangeLine {
  readonly event: WatchPartySystemEvent;
  readonly actorKey: string;
  readonly targetKey: string | null;
  readonly detail: string | null;
}

export function systemLineFor(
  { now, secrets }: Pick<Effects, 'now' | 'secrets'>,
  room: Pick<WatchPartyRoom, 'currentVideoId' | 'playback'>,
  line: ChangeLine
): NewSystemLine {
  const at = now();
  return {
    id: secrets.newId(),
    line,
    videoId: room.currentVideoId,
    positionMs: Math.round(expectedPositionMs(room.playback, at.getTime())),
    createdAt: at,
  };
}

/** A committed change is never undone by a failed broadcast: the frame is dropped and logged. */
export async function announce(
  { broadcaster, logger }: Pick<Effects, 'broadcaster' | 'logger'>,
  roomId: string,
  frame: WatchPartyServerFrame,
  toMemberKey: string | null = null
): Promise<void> {
  const sent =
    toMemberKey === null
      ? await broadcaster.toRoom(roomId, frame)
      : await broadcaster.toMember(roomId, toMemberKey, frame);
  if (!sent.ok) {
    logger.warn({ err: sent.error, roomId, frame: frame.type }, 'room frame not published');
  }
}

/** A system line a committed change wrote, out to the sockets now: the store replays it to a reconnect. */
export async function announceLine(
  deps: Pick<Effects, 'broadcaster' | 'logger'>,
  roomId: string,
  { id, line, videoId, positionMs, createdAt }: NewSystemLine
): Promise<void> {
  await announce(deps, roomId, {
    type: 'chat.message',
    message: {
      id,
      author: null,
      source: 'app',
      kind: 'system',
      body: '',
      system: line,
      videoId,
      positionMs,
      pinned: false,
      createdAt: createdAt.toISOString(),
    },
  });
}

export function logChange(
  { logger, metrics }: Pick<Effects, 'logger' | 'metrics'>,
  change: { roomId: string; actorKey: string; action: string; targetKey?: string | null }
): void {
  const roleAction = ROLE_CHANGES[change.action as keyof typeof ROLE_CHANGES];
  if (roleAction !== undefined) {
    metrics.watchPartyRoleChangesTotal.inc({ action: roleAction, result: 'applied' });
  }
  logger.info(
    {
      roomId: change.roomId,
      actorKey: change.actorKey,
      action: change.action,
      targetKey: change.targetKey ?? null,
    },
    'watch party change'
  );
}

export interface AppliedRoleWrite<T> {
  readonly value: T;
  readonly rolesVersion: number;
}

export function appliedOrRefused<T>(
  write: RoleWrite<T>,
  roomId: string,
  conflictId: string
): Result<AppliedRoleWrite<T>, WatchPartyNotFound | VersionConflict> {
  switch (write.type) {
    case 'applied':
      return ok({ value: write.value, rolesVersion: write.rolesVersion });
    case 'conflict':
      return err(versionConflict(conflictId));
    case 'missing':
      return err(watchPartyNotFound(roomId));
    default:
      return assertNever(write, 'role write');
  }
}

export async function publishRoles(
  deps: Pick<Effects, 'broadcaster' | 'logger' | 'now' | 'repositories'>,
  roomId: string,
  rolesVersion: number
): Promise<Result<(WatchPartyRoleRecord & { memberCount: number })[], DatabaseUnavailable>> {
  const listed = await deps.repositories.watchPartyRoles.list(roomId, deps.now());
  if (listed.ok) {
    await announce(deps, roomId, {
      type: 'roles',
      roles: listed.value.map(toRoleView),
      rolesVersion,
    });
  }
  return listed;
}

export async function announceMemberRoles(
  deps: Pick<Effects, 'broadcaster' | 'logger' | 'now' | 'repositories'>,
  roomId: string,
  memberKey: string,
  rolesVersion: number
): Promise<void> {
  const rows = await deps.repositories.watchPartyRoles.assignmentsOf(roomId, memberKey);
  if (!rows.ok) {
    deps.logger.warn({ err: rows.error, roomId, memberKey }, 'member roles not published');
    return;
  }
  await announce(deps, roomId, memberRolesFrame(memberKey, rows.value, rolesVersion, deps.now()));
}

export async function afterCommit<T, E>(
  committed: Result<T, E>,
  effects: (value: T) => Promise<void>
): Promise<Result<void, E>> {
  if (!committed.ok) return committed;
  await effects(committed.value);
  return ok();
}
