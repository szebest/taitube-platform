import {
  type WatchPartyClientFrame,
  WatchPartyClientFrameSchema,
  type WatchPartyServerFrame,
} from '@vp/api-contracts';
import { parseMemberKey, type RosterEntry } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { WatchPartyAbility } from '@vp/permissions';
import { assertNever, err, isErr, map, ok, parseJson, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import type { PartyCaller } from './party-caller';
import { consumeBudget } from './watch-party-budgets';
import {
  pinChat,
  type RemoveFailure,
  removeChat,
  type SendFailure,
  sendChat,
} from './watch-party-chat';
import { type CommandFailure, runCommand } from './watch-party-commands';
import { react, requestPlayback, type SignalFailure, voteSkip } from './watch-party-signals';
import type { RoomSocketDeps } from './watch-party-socket-service';
import { countCommand, countDenial, inSpan } from './watch-party-telemetry';

type Unreadable = InvalidField<{ reason: 'unreadable' }>;

export type FrameFailure =
  | Unreadable
  | CommandFailure
  | SendFailure
  | RemoveFailure
  | SignalFailure;

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
  const answered = await answer(deps, sender, frame);
  if (isErr(answered)) {
    countDenial(deps, parseMemberKey(sender.memberKey)?.kind ?? 'unknown', answered.error);
  }
  return answered;
}

const STATE_FRAMES: ReadonlySet<WatchPartyClientFrame['type']> = new Set([
  'ready',
  'away',
  'buffering',
  'stats',
]);

async function answer(
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
  if (STATE_FRAMES.has(frame.type)) {
    const spent = await consumeBudget(
      deps.gate,
      'command',
      `${roomId}:${memberKey}:state`,
      deps.config.budgets.command
    );
    if (isErr(spent)) return spent;
  }
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
      return map(
        countCommand(
          deps,
          frame.type,
          await inSpan(
            'command',
            {
              'room.id': roomId,
              'watch_party.action': frame.type,
              'watch_party.playback_version': frame.version,
              'watch_party.roles_version': frame.rolesVersion,
            },
            () => runCommand(deps, roomId, caller, frame, sender.direct)
          )
        ),
        ack
      );
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
    case 'chat.send': {
      const sent = await sendChat(deps, roomId, caller, frame.message);
      deps.metrics.watchPartyChatMessagesTotal.inc({
        source: 'app',
        outcome: sent.ok ? 'sent' : 'refused',
      });
      return map(sent, ack);
    }
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
      deps.metrics.watchPartyDriftSeconds.observe(frame.driftMs / MS_PER_SECOND);
      deps.metrics.watchPartyHardSeeksTotal.inc(frame.hardSeeks);
      return ok(ack());
    default:
      return assertNever(frame, 'WatchPartyClientFrame');
  }
}
