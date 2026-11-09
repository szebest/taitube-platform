import { effectivePermissions, expectedPositionMs, parseMemberKey } from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, announceMemberRoles, logChange } from './watch-party-moderation-effects';

type HandOver = 'kept' | 'waiting' | 'transferred';

type GraceDeps = Pick<
  WatchPartyDeps,
  'repositories' | 'presence' | 'broadcaster' | 'logger' | 'config' | 'now' | 'secrets'
>;

/**
 * After the grace, ownership of a room whose owner is not present passes to the present non-guest
 * member with the highest top position, the longest present on a tie. With nobody to take it the
 * room waits; the sweep runs this again for a pod that died mid-grace.
 */
export async function handOverAbsentOwner(
  deps: GraceDeps,
  roomId: string
): Promise<Result<HandOver, DatabaseUnavailable | CacheUnavailable>> {
  const { repositories, presence, config, now } = deps;
  const found = await repositories.watchPartyRooms.findById(roomId);
  if (isErr(found)) return found;
  const room = found.value;
  if (room === null || room.status === 'closed') return ok('kept');

  const at = now();
  const present = await presence.members(roomId, at.getTime() - config.presence.staleAfterMs);
  if (isErr(present)) return present;
  if (present.value.some(({ memberKey }) => memberKey === room.ownerKey)) {
    return ok('kept');
  }

  const [roles, assignments] = await Promise.all([
    repositories.watchPartyRoles.list(roomId, at),
    repositories.watchPartyRoles.assignmentsIn(roomId),
  ]);
  if (isErr(roles)) return roles;
  if (isErr(assignments)) return assignments;
  const ranked = present.value
    .flatMap(({ memberKey, sinceMs }) => {
      const kind = parseMemberKey(memberKey)?.kind;
      if (kind === undefined || kind === 'guest') return [];
      const { topPosition } = effectivePermissions({
        kind,
        isOwner: false,
        roles: roles.value,
        assignments: assignments.value.filter((row) => row.memberKey === memberKey),
        now: at,
      });
      return [{ memberKey, sinceMs, topPosition }];
    })
    .sort((a, b) => b.topPosition - a.topPosition || a.sinceMs - b.sinceMs);
  const heir = ranked[0];
  const cohost = roles.value.find(({ key }) => key === 'cohost');
  if (heir === undefined || cohost === undefined) return ok('waiting');

  const written = await repositories.watchPartyRooms.transferOwner(roomId, {
    fromKey: room.ownerKey,
    toKey: heir.memberKey,
    expectedRolesVersion: room.rolesVersion,
    cohostRoleId: cohost.id,
    line: {
      id: deps.secrets.newId(),
      line: { event: 'owner_changed', actorKey: null, targetKey: heir.memberKey, detail: null },
      videoId: room.currentVideoId,
      positionMs: Math.round(expectedPositionMs(room.playback, at.getTime())),
      createdAt: at,
    },
    at,
  });
  if (isErr(written)) return written;
  if (written.value.type !== 'applied') return ok('kept');

  const { rolesVersion } = written.value.room;
  logChange(deps, {
    roomId,
    actorKey: room.ownerKey,
    action: 'owner.grace',
    targetKey: heir.memberKey,
  });
  await announce(deps, roomId, { type: 'owner', memberKey: heir.memberKey, rolesVersion });
  await announceMemberRoles(deps, roomId, room.ownerKey, rolesVersion);
  return ok('transferred');
}

/** The pod that saw the owner's socket close holds the timer; a reconnect here cancels it. */
export class OwnerGrace {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly waiting = new Set<string>();

  constructor(private readonly deps: GraceDeps) {}

  begin(roomId: string): void {
    this.cancel(roomId);
    this.timers.set(
      roomId,
      setTimeout(() => void this.expire(roomId), this.deps.config.ownerGraceMs)
    );
  }

  cancel(roomId: string): void {
    clearTimeout(this.timers.get(roomId));
    this.timers.delete(roomId);
    this.waiting.delete(roomId);
  }

  /** A room whose grace ran out with only guests to inherit tries again when a non-guest arrives. */
  recheck(roomId: string): void {
    if (this.waiting.has(roomId)) void this.expire(roomId);
  }

  close(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.waiting.clear();
  }

  private async expire(roomId: string): Promise<void> {
    this.timers.delete(roomId);
    const handed = await handOverAbsentOwner(this.deps, roomId);
    if (!handed.ok) {
      this.deps.logger.warn({ err: handed.error, roomId }, 'ownership not handed over');
      return;
    }
    if (handed.value === 'waiting') this.waiting.add(roomId);
    else this.waiting.delete(roomId);
  }
}
