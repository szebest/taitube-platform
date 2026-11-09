import type { PartyQueueView, WatchPartyServerFrame, WatchPartyView } from '@vp/api-contracts';
import {
  type RoomRole,
  type WatchPartyPlayback,
  effectivePermissions,
  lobbyPlayback,
} from '@vp/domain';
import { type ErrorCode, ErrorCodes, isErrorCode } from '@vp/errors';
import { assertNever } from '@vp/result';

type PartyFrame<T extends WatchPartyServerFrame['type']> = Extract<
  WatchPartyServerFrame,
  { type: T }
>;

export type PartyChatLine = PartyFrame<'chat.message'>['message'];
export type PartyRosterEntry = PartyFrame<'hello'>['roster']['entries'][number];
export type PartyRole = PartyFrame<'hello'>['roles'][number];

type PartyConnection = 'connecting' | 'open' | 'closed';
type PartyEnd = 'kicked' | 'superseded' | 'closed';

export interface PartyRequest {
  key: string;
  from: string;
  kind: PartyFrame<'request'>['kind'];
  positionMs?: number;
}

export interface WatchPartyState {
  connection: PartyConnection;
  ended: PartyEnd | null;
  room: WatchPartyView | null;
  roles: PartyRole[];
  rolesVersion: number;
  you: PartyFrame<'hello'>['you'] | null;
  expiries: Record<string, string | null>;
  playback: WatchPartyPlayback;
  version: number;
  queue: PartyQueueView;
  votes: { itemId: string; votes: number; needed: number } | null;
  countdownEndsAt: number | null;
  roster: PartyRosterEntry[];
  guests: number;
  lines: PartyChatLine[];
  pinned: PartyChatLine | null;
  chatMode: PartyFrame<'hello'>['chat']['mode'] | null;
  requests: PartyRequest[];
  refusal: ErrorCode | null;
}

export type WatchPartyAction =
  | { type: 'frame'; frame: WatchPartyServerFrame }
  | { type: 'connection'; connection: PartyConnection }
  | { type: 'dismissRequest'; key: string };

/** @internal */
export const PARTY_LINES_KEPT = 500;

export const INITIAL_WATCH_PARTY: WatchPartyState = {
  connection: 'connecting',
  ended: null,
  room: null,
  roles: [],
  rolesVersion: 0,
  you: null,
  expiries: {},
  playback: lobbyPlayback(null),
  version: 0,
  queue: { items: [], version: 0 },
  votes: null,
  countdownEndsAt: null,
  roster: [],
  guests: 0,
  lines: [],
  pinned: null,
  chatMode: null,
  requests: [],
  refusal: null,
};

function withLine(lines: PartyChatLine[], line: PartyChatLine): PartyChatLine[] {
  if (lines.some((shown) => shown.id === line.id)) {
    return lines;
  }

  return [...lines, line].slice(-PARTY_LINES_KEPT);
}

function mergeRoster(
  roster: PartyRosterEntry[],
  upserts: PartyRosterEntry[],
  removals: string[]
): PartyRosterEntry[] {
  const dropped = new Set(removals);
  const replaced = new Map(upserts.map((person) => [person.memberKey, person]));
  const kept = roster
    .filter((person) => !dropped.has(person.memberKey))
    .map((person) => replaced.get(person.memberKey) ?? person);
  const known = new Set(kept.map((person) => person.memberKey));

  return [...kept, ...upserts.filter((person) => !known.has(person.memberKey))];
}

function applyFrame(state: WatchPartyState, frame: WatchPartyServerFrame): WatchPartyState {
  switch (frame.type) {
    case 'hello':
      return {
        ...state,
        connection: 'open',
        ended: null,
        room: frame.room,
        roles: frame.roles,
        rolesVersion: frame.rolesVersion,
        you: frame.you,
        expiries: {},
        playback: frame.playback,
        version: frame.version,
        queue: frame.queue,
        roster: frame.roster.entries,
        guests: frame.roster.guests,
        lines: frame.chat.resume === 'replayed' ? state.lines : [],
        pinned: frame.chat.pinned,
        chatMode: frame.chat.mode,
        countdownEndsAt: null,
        refusal: null,
      };
    case 'state':
      if (frame.version <= state.version) {
        return state;
      }
      return {
        ...state,
        playback: frame.playback,
        version: frame.version,
        countdownEndsAt: frame.playback.phase === 'playing' ? null : state.countdownEndsAt,
      };
    case 'countdown':
      return { ...state, countdownEndsAt: frame.startsAt };
    case 'queue':
      return { ...state, queue: { items: frame.items, version: frame.version } };
    case 'votes':
      return {
        ...state,
        votes: { itemId: frame.itemId, votes: frame.votes, needed: frame.needed },
      };
    case 'chat.message':
      return { ...state, lines: withLine(state.lines, frame.message) };
    case 'chat.removed':
      return {
        ...state,
        lines: state.lines.filter((line) => line.id !== frame.id),
        pinned: state.pinned?.id === frame.id ? null : state.pinned,
      };
    case 'chat.pinned':
      return { ...state, pinned: frame.message };
    case 'chat.mode':
      return { ...state, chatMode: frame.mode };
    case 'roster.patch':
      return {
        ...state,
        roster: mergeRoster(state.roster, frame.upserts, frame.removals),
        guests: frame.guests,
      };
    case 'settings':
      return { ...state, room: frame.room };
    case 'roles':
      return { ...state, roles: frame.roles, rolesVersion: frame.rolesVersion };
    case 'member.roles':
      if (state.you?.memberKey !== frame.memberKey) {
        return { ...state, rolesVersion: frame.rolesVersion };
      }
      return {
        ...state,
        you: { ...state.you, roleIds: frame.roleIds },
        expiries: frame.expiries,
        rolesVersion: frame.rolesVersion,
      };
    case 'owner':
      return {
        ...state,
        room: state.room && {
          ...state.room,
          owner: { ...state.room.owner, memberKey: frame.memberKey },
        },
        rolesVersion: frame.rolesVersion,
      };
    case 'you':
      return {
        ...state,
        you: { memberKey: frame.memberKey, kind: frame.kind, roleIds: frame.roleIds },
      };
    case 'request':
      return {
        ...state,
        requests: [
          ...state.requests,
          {
            key: `${frame.from}:${frame.kind}:${state.requests.length}:${frame.positionMs ?? ''}`,
            from: frame.from,
            kind: frame.kind,
            positionMs: frame.positionMs,
          },
        ],
      };
    case 'reactions':
    case 'clock':
    case 'ack':
      return state;
    case 'error':
      return {
        ...state,
        refusal: isErrorCode(frame.problem.code) ? frame.problem.code : ErrorCodes.INTERNAL,
      };
    case 'kicked':
      return { ...state, ended: 'kicked' };
    case 'superseded':
      return { ...state, ended: 'superseded' };
    case 'closed':
      return { ...state, ended: 'closed' };
    default:
      return assertNever(frame, 'WatchPartyServerFrame');
  }
}

/** What the room page shows, folded from the room socket's frames. */
export function watchPartyReducer(
  state: WatchPartyState,
  action: WatchPartyAction
): WatchPartyState {
  switch (action.type) {
    case 'frame':
      return applyFrame(state, action.frame);
    case 'connection':
      return { ...state, connection: action.connection };
    case 'dismissRequest':
      return { ...state, requests: state.requests.filter((request) => request.key !== action.key) };
    default:
      return assertNever(action, 'WatchPartyAction');
  }
}

/** The viewer's permissions now: `effectivePermissions` over their roles, ignoring an expired mute. */
export function selectPartyPermissions(state: WatchPartyState, now: Date) {
  const { room, you } = state;
  if (!room || !you) {
    return { permissions: [], topPosition: 0 } as ReturnType<typeof effectivePermissions>;
  }

  return effectivePermissions({
    kind: you.kind,
    isOwner: room.owner.memberKey === you.memberKey,
    roles: state.roles as RoomRole[],
    assignments: you.roleIds.map((roleId) => {
      const expiry = state.expiries[roleId];
      return { roleId, expiresAt: expiry ? new Date(expiry) : null };
    }),
    now,
  });
}
