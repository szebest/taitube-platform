import type { CreateWatchPartyBody, WatchPartyView } from '@vp/api-contracts';
import type { HashingFailed } from '@vp/core/ports';
import {
  builtInRoles,
  defaultAllowGuests,
  lobbyPlayback,
  memberKeyOf,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
  type WatchPartyRoom,
  type WatchPartySettings,
} from '@vp/domain';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import { MS_PER_HOUR } from '@vp/domain/time';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  type WatchPartyLimitReached,
  type WatchPartyVideoNotShareable,
  watchPartyLimitReached,
} from '@vp/errors';
import { canCreateWatchParty, type UserContext } from '@vp/permissions';
import { andThenAsync, err, isErr, ok, type Result } from '@vp/result';
import {
  type InvalidField,
  invalidField,
  ROOM_NAME_BOUNDS,
  validateRoomName,
} from '@vp/validation';
import type { PartyCaller } from './party-caller';
import { consumeBudget, type RateLimited } from './watch-party-budgets';
import type { WatchPartyDeps } from './watch-party-deps';
import { resolvePeople } from './watch-party-names';
import { toNewSeat } from './watch-party-principals';
import { checkRoomInput, type InvalidRoomInput } from './watch-party-room-input';
import { presentRoom } from './watch-party-room-views';
import { resolveSource } from './watch-party-sources';

export type CreateFailure =
  | AuthorizationFailure
  | InvalidRoomInput
  | InvalidField
  | RateLimited
  | WatchPartyLimitReached
  | WatchPartyVideoNotShareable
  | HashingFailed
  | CacheUnavailable
  | DatabaseUnavailable;

const REUSE_WINDOW_MS = MS_PER_HOUR;
const FALLBACK_NAME = 'Watch party';

type CreateDeps = WatchPartyDeps;

async function hostedChannelId(
  { repositories }: CreateDeps,
  owner: UserContext,
  hostAs: CreateWatchPartyBody['hostAs']
): Promise<Result<string | null, InvalidField | DatabaseUnavailable>> {
  if (hostAs === 'user') return ok(null);
  const channel = await repositories.channels.findByUserId(owner.id);
  if (isErr(channel)) return channel;
  const published = await repositories.videos.listPublic({ ownerId: owner.id, limit: 1 });
  if (isErr(published)) return published;
  return channel.value === null || published.value.items.length === 0
    ? err(invalidField('hostAs', 'hostAs channel needs a channel with a public ready video', {}))
    : ok(channel.value.id);
}

async function reusableRoom(
  { repositories, now }: CreateDeps,
  ownerKey: string,
  firstVideoId: string | null
): Promise<Result<WatchPartyRoom | null, DatabaseUnavailable>> {
  if (firstVideoId === null) return ok(null);
  const open = await repositories.watchPartyRooms.listOpenOwnedBy(ownerKey);
  return andThenAsync(open, async (rooms) => {
    const since = now().getTime() - REUSE_WINDOW_MS;
    for (const room of rooms) {
      if (room.phase !== 'lobby' || room.currentVideoId !== firstVideoId) continue;
      if (room.createdAt.getTime() < since) continue;
      const seated = await repositories.watchPartyMembers.listSeated(room.id);
      if (isErr(seated)) return seated;
      if (seated.value.every((seat) => seat.memberKey === ownerKey)) return ok(room);
    }
    return ok(null);
  });
}

async function startingName(
  { repositories }: CreateDeps,
  ownerKey: string,
  firstTitle: string | null
): Promise<Result<string, DatabaseUnavailable>> {
  const people = await resolvePeople(repositories.channels, [ownerKey]);
  return andThenAsync(people, (personOf) => {
    const candidates = [firstTitle ?? '', `${personOf(ownerKey).name}'s watch party`];
    for (const candidate of candidates) {
      const name = validateRoomName(candidate.slice(0, ROOM_NAME_BOUNDS.maxLength));
      if (name.ok) return ok(name.value);
    }
    return ok(FALLBACK_NAME);
  });
}

async function withinAllowance(
  { gate, config, repositories }: CreateDeps,
  owner: UserContext,
  ownerKey: string
): Promise<
  Result<void, RateLimited | WatchPartyLimitReached | CacheUnavailable | DatabaseUnavailable>
> {
  const spent = await consumeBudget(gate, 'create', owner.id, config.budgets.create);
  if (isErr(spent)) return spent;
  const open = await repositories.watchPartyRooms.countOpenOwnedBy(ownerKey);
  if (isErr(open)) return open;
  return open.value >= config.maxOpenPerUser
    ? err(watchPartyLimitReached(config.maxOpenPerUser))
    : ok();
}

function settingsOf(
  body: CreateWatchPartyBody,
  checked: { name: string; capacity: number | null; scheduledFor: Date | null }
): WatchPartySettings {
  const quick = QUICK_PARTY_SETTINGS;
  return {
    name: checked.name,
    visibility: body.visibility,
    capacity: checked.capacity,
    allowGuests:
      body.allowGuests === undefined ? defaultAllowGuests(body.visibility) : body.allowGuests,
    chatEnabled: body.chatEnabled ?? quick.chatEnabled,
    slowModeSeconds: body.slowModeSeconds ?? quick.slowModeSeconds,
    bufferPolicy: body.bufferPolicy ?? quick.bufferPolicy,
    autoplay: body.autoplay ?? quick.autoplay,
    skipVotePercent: body.skipVotePercent ?? quick.skipVotePercent,
    idleClose: body.idleClose ?? quick.idleClose,
    language: body.language ?? quick.language,
    accent: body.accent ?? quick.accent,
    scheduledFor: checked.scheduledFor,
    autoStart: body.autoStart ?? quick.autoStart,
  };
}

export async function createRoom(
  deps: CreateDeps,
  caller: PartyCaller,
  body: CreateWatchPartyBody
): Promise<Result<WatchPartyView, CreateFailure>> {
  const { repositories, hasher, config, secrets, logger, now } = deps;
  const actor = authorize(caller.user, canCreateWatchParty(caller.user), {
    action: 'create',
    subject: 'WatchParty',
  });
  if (isErr(actor)) return actor;
  const owner = actor.value;
  const ownerKey = memberKeyOf({ kind: 'user', userId: owner.id });
  const at = now();

  const checked = checkRoomInput(body, { ceiling: config.maxMembers, now: at });
  if (isErr(checked)) return checked;
  const { value: input } = checked;

  const roomId = secrets.newId();
  const queue = await resolveSource(
    deps,
    { roomId, ownerKey, actor: owner, visibility: body.visibility },
    body.source
  );
  if (isErr(queue)) return queue;
  const [first] = queue.value.items;

  const asChannelId = await hostedChannelId(deps, owner, body.hostAs);
  if (isErr(asChannelId)) return asChannelId;

  if (body.reuse === true) {
    const reusable = await reusableRoom(deps, ownerKey, first?.videoId ?? null);
    if (isErr(reusable)) return reusable;
    if (reusable.value !== null) return presentRoom(deps, reusable.value);
  }

  const allowed = await withinAllowance(deps, owner, ownerKey);
  if (isErr(allowed)) return allowed;

  const name =
    input.name === undefined
      ? await startingName(deps, ownerKey, queue.value.firstTitle)
      : ok(input.name);
  if (isErr(name)) return name;

  const passwordHash =
    typeof input.password === 'string' ? await hasher.hash(input.password) : ok(null);
  if (isErr(passwordHash)) return passwordHash;

  const created = await repositories.watchPartyRooms.create({
    room: {
      ...settingsOf(body, {
        name: name.value,
        capacity: input.capacity ?? null,
        scheduledFor: input.scheduledFor ?? null,
      }),
      id: roomId,
      ownerKey,
      asChannelId: asChannelId.value,
      passwordHash: passwordHash.value,
      playback: lobbyPlayback(first?.id ?? null, first?.startMs),
      permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
      createdAt: at,
    },
    roles: builtInRoles(body.preset).map((role) => ({ id: secrets.newId(), ...role })),
    owner: toNewSeat({
      roomId,
      principal: { kind: 'user', userId: owner.id },
      joinedVia: 'owner',
      joinedAt: at,
      ipHash: null,
    }),
    queue: queue.value.items,
  });
  if (isErr(created)) return created;

  logger.info({ roomId, ownerKey }, 'watch party created');
  return presentRoom(deps, created.value);
}
