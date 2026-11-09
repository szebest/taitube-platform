import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { expectedPositionMs, type WatchPartyMessage } from '@vp/domain';
import { decideWatchPartyChatPost, requireRoomPermission } from '@vp/domain-rules';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  type WatchPartyChatOff,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  type WatchPartyPermissionMissing,
  type WatchPartySlowMode,
  watchPartySlowMode,
} from '@vp/errors';
import { err, isErr, map, ok, type Result } from '@vp/result';
import { type InvalidChatMessage, validateChatMessage } from '@vp/validation';
import { readChatBacklog } from '../live-chat-backlog';
import type { PartyCaller } from './party-caller';
import { consumeBudget, type RateLimited } from './watch-party-budgets';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, systemLineFor } from './watch-party-moderation-effects';
import { type PersonOf, resolvePeople } from './watch-party-names';
import { loadSeated } from './watch-party-seated-actions';

type ChatMessageView = Extract<WatchPartyServerFrame, { type: 'chat.message' }>['message'];
type ChatDeps = Pick<WatchPartyDeps, 'repositories' | 'broadcaster' | 'logger'>;
type SeatedFailure = WatchPartyNotFound | WatchPartyClosed | DatabaseUnavailable;
type ModerateFailure = SeatedFailure | WatchPartyPermissionMissing;
export type SendFailure =
  | ModerateFailure
  | InvalidChatMessage
  | WatchPartyChatOff
  | WatchPartySlowMode
  | RateLimited
  | CacheUnavailable;

function toChatMessageView(message: WatchPartyMessage, personOf: PersonOf): ChatMessageView {
  return {
    id: message.id,
    author: message.authorKey === null ? null : personOf(message.authorKey),
    source: message.source,
    kind: message.kind,
    body: message.body,
    system: message.system,
    videoId: message.videoId,
    positionMs: message.positionMs,
    pinned: message.pinned,
    createdAt: message.createdAt.toISOString(),
  };
}

async function chatViews(
  { repositories }: Pick<WatchPartyDeps, 'repositories'>,
  messages: readonly WatchPartyMessage[]
): Promise<Result<ChatMessageView[], DatabaseUnavailable>> {
  const authors = messages.flatMap(({ authorKey }) => (authorKey === null ? [] : [authorKey]));
  const people = await resolvePeople(repositories.channels, [...new Set(authors)]);
  return map(people, (personOf) => messages.map((line) => toChatMessageView(line, personOf)));
}

/** A stored line, out to every socket; a socket that misses the publish has it on its next resume. */
async function publishLine(deps: ChatDeps, message: WatchPartyMessage): Promise<void> {
  const view = await chatViews(deps, [message]);
  const [line] = isErr(view) ? [] : view.value;
  if (line) await announce(deps, message.roomId, { type: 'chat.message', message: line });
}

/** What a connecting socket is sent: the lines it missed, those removed since, and the pinned one. */
export async function readRoomChat(
  deps: Pick<WatchPartyDeps, 'repositories' | 'config'>,
  roomId: string,
  after: string | null
) {
  const { watchPartyMessages } = deps.repositories;
  const [backlog, pinned] = await Promise.all([
    readChatBacklog(watchPartyMessages, roomId, after, deps.config.chatBacklog),
    watchPartyMessages.findPinned(roomId),
  ]);
  if (isErr(backlog)) return backlog;
  if (isErr(pinned)) return pinned;
  const views = await chatViews(deps, [
    ...backlog.value.lines,
    ...(pinned.value === null ? [] : [pinned.value]),
  ]);
  return map(views, (lines) => ({
    resume: backlog.value.resume,
    removed: backlog.value.removed,
    lines: lines.slice(0, backlog.value.lines.length),
    pinned: pinned.value === null ? null : (lines.at(-1) ?? null),
  }));
}

/** Stored before it is published, so a reconnect's backlog never misses a line. */
export async function sendChat(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  text: string
): Promise<Result<string, SendFailure>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const { context, memberKey } = seated.value;
  const message = validateChatMessage(text);
  if (isErr(message)) return message;
  const grant = decideWatchPartyChatPost({ room: context.room, ability: context.ability });
  if (isErr(grant)) return grant;
  const { gate, config, repositories, secrets, now } = deps;
  const spent = await consumeBudget(gate, 'chat', `${roomId}:${memberKey}`, config.budgets.chat);
  if (isErr(spent)) return spent;
  if (grant.value.slowModeSeconds > 0) {
    const slow = await gate.slowMode(roomId, memberKey, grant.value.slowModeSeconds);
    if (isErr(slow)) return slow;
    if (slow.value.type === 'refused') {
      return err(watchPartySlowMode(slow.value.retryAfterSeconds));
    }
  }
  const at = now();
  const { room } = context;
  const appended = await repositories.watchPartyMessages.append({
    id: secrets.newId(),
    roomId,
    authorKey: memberKey,
    source: 'app',
    kind: 'text',
    body: message.value,
    system: null,
    videoId: room.currentVideoId,
    positionMs: Math.round(expectedPositionMs(room.playback, at.getTime())),
    createdAt: at,
  });
  if (isErr(appended)) return appended;
  await publishLine(deps, appended.value);
  return ok(appended.value.id);
}

export async function removeChat(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  id: string
): Promise<Result<string, ModerateFailure>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const { context, memberKey } = seated.value;
  const held = requireRoomPermission(context.ability, 'chat.moderate');
  if (isErr(held)) return held;
  const { watchPartyMessages } = deps.repositories;
  const removed = await watchPartyMessages.remove(roomId, id, deps.now());
  if (isErr(removed)) return removed;
  if (!removed.value) return ok(id);

  await announce(deps, roomId, { type: 'chat.removed', id });
  const {
    id: lineId,
    line,
    videoId,
    positionMs,
    createdAt,
  } = systemLineFor(deps, context.room, {
    event: 'message_removed',
    actorKey: memberKey,
    targetKey: null,
    detail: id,
  });
  const appended = await watchPartyMessages.append({
    id: lineId,
    roomId,
    authorKey: null,
    source: 'app',
    kind: 'system',
    body: '',
    system: line,
    videoId,
    positionMs,
    createdAt,
  });
  if (isErr(appended)) return appended;
  await publishLine(deps, appended.value);
  return ok(id);
}

export async function pinChat(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  id: string | null
): Promise<Result<string, ModerateFailure>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const held = requireRoomPermission(seated.value.context.ability, 'chat.pin');
  if (isErr(held)) return held;
  const pinned = await deps.repositories.watchPartyMessages.pin(roomId, id);
  if (isErr(pinned)) return pinned;
  const views = await chatViews(deps, pinned.value === null ? [] : [pinned.value]);
  if (isErr(views)) return views;
  await announce(deps, roomId, { type: 'chat.pinned', message: views.value[0] ?? null });
  return ok(id ?? 'unpinned');
}
