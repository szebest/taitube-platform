import {
  type WatchPartyClientFrame,
  WatchPartyClientFrameSchema,
  type WatchPartyServerFrame,
} from '@vp/api-contracts';
import type { RosterEntry } from '@vp/domain';
import type { WatchPartyAbility } from '@vp/permissions';
import { assertNever, err, isErr, map, ok, parseJson, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import type { PartyCaller } from './party-caller';
import { pinChat, removeChat, type SendFailure, sendChat } from './watch-party-chat';
import { type CommandFailure, runCommand } from './watch-party-commands';
import { react, requestPlayback, type SignalFailure, voteSkip } from './watch-party-signals';
import type { RoomSocketDeps } from './watch-party-socket-service';

type Unreadable = InvalidField<{ reason: 'unreadable' }>;

export type FrameFailure = Unreadable | CommandFailure | SendFailure | SignalFailure;

/** The sender as the frame's handlers need it, and the two things a frame may change on it. */
export interface FrameSender {
  readonly roomId: string;
  readonly caller: PartyCaller;
  readonly memberKey: string;
  readonly guest: boolean;
  readonly ability: WatchPartyAbility;
  direct(frame: WatchPartyServerFrame): void;
  patch(change: Partial<RosterEntry>): void;
}

/** A frame past the size limit, not JSON or outside the contract is refused, never thrown. */
export function readFrame(
  raw: string,
  maxBytes: number
): Result<WatchPartyClientFrame, Unreadable> {
  const unreadable = err(
    invalidField('frame', 'Not a room frame', { reason: 'unreadable' as const })
  );
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) return unreadable;
  const decoded = parseJson(raw);
  const frame = isErr(decoded) ? null : WatchPartyClientFrameSchema.safeParse(decoded.value);
  return frame?.success ? ok(frame.data) : unreadable;
}

export async function answerFrame(
  deps: RoomSocketDeps,
  sender: FrameSender,
  frame: WatchPartyClientFrame
): Promise<Result<WatchPartyServerFrame, FrameFailure>> {
  const { roomId, caller, memberKey } = sender;
  const ack = (): WatchPartyServerFrame => ({ type: 'ack', ref: frame.ref });
  const patched = (change: Partial<RosterEntry>) => {
    sender.patch(change);
    return ok(ack());
  };
  switch (frame.type) {
    case 'clock':
      return ok({ type: 'clock', t0: frame.t0, serverNow: deps.now().getTime() });
    case 'play':
    case 'pause':
    case 'seek':
    case 'rate':
    case 'next':
    case 'start':
    case 'ended':
      return map(await runCommand(deps, roomId, caller, frame, sender.direct), ack);
    case 'ready':
      return patched({ ready: frame.ready });
    case 'away':
      return patched({ away: frame.away });
    case 'buffering':
      if (frame.buffering && !sender.guest) deps.buffering.start(roomId, memberKey);
      if (!frame.buffering) deps.buffering.stop(roomId, memberKey);
      return patched({ sync: frame.buffering ? 'buffering' : 'in_sync' });
    case 'skipVote':
      return map(await voteSkip(deps, roomId, caller, frame.itemId), ack);
    case 'request':
      return map(await requestPlayback(deps, roomId, caller, frame), ack);
    case 'chat.send':
      return map(await sendChat(deps, roomId, caller, frame.message), ack);
    case 'chat.remove':
      return map(await removeChat(deps, roomId, caller, frame.id), ack);
    case 'chat.pin':
      return map(await pinChat(deps, roomId, caller, frame.id), ack);
    case 'react': {
      const { emoji } = frame;
      const reacted = await react(deps, deps.reactions, {
        roomId,
        memberKey,
        emoji,
        ability: sender.ability,
      });
      return map(reacted, ack);
    }
    case 'stats':
      return ok(ack());
    default:
      return assertNever(frame, 'WatchPartyClientFrame');
  }
}
