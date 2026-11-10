import type { WatchPartyServerFrame } from '@vp/api-contracts';
import {
  INITIAL_WATCH_PARTY,
  type PartyChatLine,
  type WatchPartyAction,
  type WatchPartyState,
  watchPartyReducer,
} from '../watch-party-state';

const ID = (n: number) => `0190c3a0-5e1d-7000-8000-${String(n).padStart(12, '0')}`;
const SELF = `user:${ID(1)}`;
const OTHER = `user:${ID(2)}`;

const PLAYBACK = { itemId: ID(50), phase: 'paused', positionMs: 0, rate: 1, anchorAt: 0 } as const;
const ROOM = {
  id: ID(9),
  name: 'Movie night',
  owner: { memberKey: OTHER, name: 'Ana', avatarUrl: null },
  chatEnabled: true,
  slowModeSeconds: 0,
  phase: 'lobby',
} as never;

function entry(memberKey: string, patch: object = {}) {
  return {
    memberKey,
    kind: 'user',
    source: 'app',
    name: memberKey,
    avatarUrl: null,
    roleIds: [],
    ready: false,
    sync: 'lobby',
    voice: 'off',
    away: false,
    ...patch,
  } as never;
}

function line(n: number, body = `line ${n}`): PartyChatLine {
  return {
    id: ID(100 + n),
    author: { memberKey: OTHER, name: 'Ana', avatarUrl: null },
    source: 'app',
    kind: 'text',
    body,
    system: null,
    videoId: null,
    positionMs: null,
    pinned: false,
    createdAt: '2026-11-05T10:00:00.000Z',
  } as unknown as PartyChatLine;
}

const HELLO = {
  type: 'hello',
  room: ROOM,
  roles: [],
  rolesVersion: 3,
  you: { memberKey: SELF, kind: 'user', roleIds: [] },
  playback: PLAYBACK,
  version: 7,
  serverNow: 1000,
  queue: { items: [], version: 2 },
  roster: { entries: [entry(SELF), entry(OTHER)], guests: 2 },
  chat: { resume: 'fresh', mode: { enabled: true, slowModeSeconds: 0 }, pinned: null },
} as unknown as WatchPartyServerFrame;

const frame = (value: object): WatchPartyAction => ({
  type: 'frame',
  frame: value as WatchPartyServerFrame,
});

function fold(...actions: WatchPartyAction[]): WatchPartyState {
  return actions.reduce(watchPartyReducer, INITIAL_WATCH_PARTY);
}

describe('packages/queries: watchPartyReducer', () => {
  it('takes the whole room from hello', () => {
    const state = fold(frame(HELLO));

    expect(state).toMatchObject({
      connection: 'open',
      version: 7,
      rolesVersion: 3,
      you: { memberKey: SELF },
      guests: 2,
    });
    expect(state.roster.map((person) => person.memberKey)).toEqual([SELF, OTHER]);
  });

  it.each([
    { name: 'a newer state', version: 8, applied: true },
    { name: 'an older state', version: 6, applied: false },
  ])('$name: applied $applied', ({ version, applied }) => {
    const state = fold(
      frame(HELLO),
      frame({
        type: 'state',
        playback: { ...PLAYBACK, phase: 'playing' },
        version,
        by: OTHER,
        reason: 'command',
      })
    );

    expect(state.playback.phase).toBe(applied ? 'playing' : 'paused');
  });

  it('merges a roster patch: upserts replace, removals drop, guests count follows', () => {
    const state = fold(
      frame(HELLO),
      frame({
        type: 'roster.patch',
        upserts: [entry(OTHER, { ready: true }), entry(`user:${ID(3)}`)],
        removals: [SELF],
        guests: 0,
      })
    );

    expect(state.roster.map(({ memberKey, ready }) => [memberKey, ready])).toEqual([
      [OTHER, true],
      [`user:${ID(3)}`, false],
    ]);
    expect(state.guests).toBe(0);
  });

  it('keeps chat lines once each and removes by id', () => {
    const state = fold(
      frame(HELLO),
      frame({ type: 'chat.message', message: line(1) }),
      frame({ type: 'chat.message', message: line(1) }),
      frame({ type: 'chat.message', message: line(2) }),
      frame({ type: 'chat.removed', id: line(1).id })
    );

    expect(state.lines.map((shown) => shown.id)).toEqual([line(2).id]);
  });

  it('replaces the lines on an expired resume but keeps them on a replayed one', () => {
    const withLine = fold(frame(HELLO), frame({ type: 'chat.message', message: line(1) }));
    const hello = (resume: string) =>
      frame({
        ...(HELLO as object),
        chat: { resume, mode: { enabled: true, slowModeSeconds: 0 }, pinned: null },
      });

    expect(watchPartyReducer(withLine, hello('replayed')).lines).toHaveLength(1);
    expect(watchPartyReducer(withLine, hello('expired')).lines).toHaveLength(0);
  });

  it('applies a roles frame and one member roles frame to the viewer', () => {
    const state = fold(
      frame(HELLO),
      frame({
        type: 'member.roles',
        memberKey: SELF,
        roleIds: [ID(70)],
        expiries: { [ID(70)]: '2026-11-05T10:10:00.000Z' },
        rolesVersion: 4,
      })
    );

    expect(state.you?.roleIds).toEqual([ID(70)]);
    expect(state.expiries).toEqual({ [ID(70)]: '2026-11-05T10:10:00.000Z' });
    expect(state.rolesVersion).toBe(4);
  });

  it('changes owner, queue, votes, countdown and the pin', () => {
    const state = fold(
      frame(HELLO),
      frame({ type: 'owner', memberKey: SELF, rolesVersion: 4 }),
      frame({ type: 'queue', items: [], version: 3 }),
      frame({ type: 'votes', itemId: ID(50), votes: 1, needed: 2 }),
      frame({ type: 'countdown', startsAt: 5000 }),
      frame({ type: 'chat.pinned', message: line(1) })
    );

    expect(state.room?.owner.memberKey).toBe(SELF);
    expect(state.queue.version).toBe(3);
    expect(state.votes).toEqual({ itemId: ID(50), votes: 1, needed: 2 });
    expect(state.countdownEndsAt).toBe(5000);
    expect(state.pinned?.id).toBe(line(1).id);
  });

  it.each([
    { frame: { type: 'kicked' }, end: 'kicked' },
    { frame: { type: 'superseded' }, end: 'superseded' },
    { frame: { type: 'closed', reason: 'owner' }, end: 'closed' },
  ])('ends the visit on $frame.type', ({ frame: ended, end }) => {
    expect(fold(frame(HELLO), frame(ended)).ended).toBe(end);
  });

  it('keeps requests for controllers and dismisses one', () => {
    const asked = fold(
      frame(HELLO),
      frame({ type: 'request', from: OTHER, kind: 'seek', positionMs: 5 })
    );
    const [request] = asked.requests;

    expect(request).toMatchObject({ from: OTHER, kind: 'seek' });
    expect(
      watchPartyReducer(asked, { type: 'dismissRequest', key: request?.key ?? '' }).requests
    ).toEqual([]);
  });

  it('records an error frame as the latest refusal', () => {
    const state = fold(
      frame(HELLO),
      frame({ type: 'error', ref: 'x', problem: { code: 'WATCH_PARTY_SLOW_MODE', status: 429 } })
    );

    expect(state.refusal).toBe('WATCH_PARTY_SLOW_MODE');
  });
});
