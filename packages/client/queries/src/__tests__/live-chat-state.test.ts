import type { LiveChatMessageView, LiveChatServerFrame } from '@vp/api-contracts';

import {
  INITIAL_LIVE_CHAT,
  LIVE_CHAT_LINES_KEPT,
  type LiveChatAction,
  type LiveChatState,
  liveChatReducer,
} from '../live-chat-state';

const MODE = { slowModeSeconds: 0, subscribersOnly: false };
const AUTHOR = {
  userId: '0190c3a0-5e1d-7000-8000-00000000f001',
  handle: 'marta',
  displayName: 'Marta',
  avatarUrl: null,
};

function message(n: number, text = `line ${n}`): LiveChatMessageView {
  return {
    id: `0190c3a0-5e1d-7000-8000-${String(n).padStart(12, '0')}`,
    author: AUTHOR,
    message: text,
    offsetMs: n * 1000,
    createdAt: '2026-11-05T10:00:00.000Z',
  };
}

const frame = (value: LiveChatServerFrame): LiveChatAction => ({ type: 'frame', frame: value });

function fold(...actions: LiveChatAction[]): LiveChatState {
  return actions.reduce(liveChatReducer, INITIAL_LIVE_CHAT);
}

const shown = (state: LiveChatState) =>
  state.lines.map(({ key, text, state: lineState }) => ({ key, text, state: lineState }));

describe('packages/queries: liveChatReducer', () => {
  it.each([
    { resume: 'fresh', kept: ['ref-1'] },
    { resume: 'expired', kept: ['ref-1'] },
    { resume: 'replayed', kept: [message(1).id, 'ref-1'] },
  ] as const)('keeps $kept across a $resume hello', ({ resume, kept }) => {
    const state = fold(
      frame({ type: 'message', message: message(1) }),
      { type: 'sending', ref: 'ref-1', text: 'hi' },
      frame({ type: 'hello', resume, mode: MODE, canSend: true, canModerate: false })
    );

    expect(state.lines.map((line) => line.key)).toEqual(kept);
    expect(state).toMatchObject({ connection: 'open', canSend: true, mode: MODE });
  });

  it('shows a line once when the socket repeats it', () => {
    const state = fold(
      frame({ type: 'message', message: message(1) }),
      frame({ type: 'message', message: message(1) })
    );

    expect(shown(state)).toEqual([{ key: message(1).id, text: 'line 1', state: 'sent' }]);
  });

  it(`keeps the latest ${LIVE_CHAT_LINES_KEPT} lines`, () => {
    const lines = Array.from({ length: LIVE_CHAT_LINES_KEPT + 2 }, (_, n) =>
      frame({ type: 'message', message: message(n) })
    );

    const state = fold(...lines);

    expect(state.lines).toHaveLength(LIVE_CHAT_LINES_KEPT);
    expect(state.lines[0]?.id).toBe(message(2).id);
  });

  it.each([
    {
      order: 'the ack before the echo',
      frames: [
        { type: 'ack', ref: 'ref-1', id: message(7).id },
        { type: 'message', message: message(7, 'hi') },
      ],
    },
    {
      order: 'the echo before the ack',
      frames: [
        { type: 'message', message: message(7, 'hi') },
        { type: 'ack', ref: 'ref-1', id: message(7).id },
      ],
    },
  ] satisfies { order: string; frames: LiveChatServerFrame[] }[])(
    "settles the viewer's own line once, with $order",
    ({ frames }) => {
      const state = fold({ type: 'sending', ref: 'ref-1', text: 'hi' }, ...frames.map(frame));

      expect(state.lines).toHaveLength(1);
      expect(state.lines[0]).toMatchObject({ id: message(7).id, text: 'hi', state: 'sent' });
    }
  );

  it.each([
    {
      cause: 'the API refused it',
      action: frame({
        type: 'error',
        ref: 'ref-1',
        problem: {
          type: 'about:blank',
          title: 'Slow mode',
          status: 429,
          detail: 'wait',
          code: 'LIVE_CHAT_SLOW_MODE',
          instance: '/v1/live/x/chat',
        },
      }),
      refusal: 'LIVE_CHAT_SLOW_MODE',
    },
    {
      cause: 'the socket was closed',
      action: { type: 'unsent', ref: 'ref-1' } as const,
      refusal: null,
    },
  ])('marks the line failed when $cause', ({ action, refusal }) => {
    const state = fold({ type: 'sending', ref: 'ref-1', text: 'hi' }, action);

    expect(shown(state)).toEqual([{ key: 'ref-1', text: 'hi', state: 'failed' }]);
    expect(state.refusal).toBe(refusal);
  });

  it('keeps a removed line removed when the socket repeats it', () => {
    const state = fold(
      frame({ type: 'message', message: message(1) }),
      frame({ type: 'removed', id: message(1).id }),
      frame({ type: 'message', message: message(1) })
    );

    expect(state.lines[0]?.state).toBe('removed');
  });

  it('takes the chat mode the creator set', () => {
    const slow = { slowModeSeconds: 30, subscribersOnly: true };

    expect(fold(frame({ type: 'mode', mode: slow })).mode).toEqual(slow);
  });

  it('fails the lines still on their way when the socket closes, so they offer Retry', () => {
    const state = fold(
      { type: 'sending', ref: 'ref-1', text: 'hi' },
      { type: 'connection', connection: 'closed' }
    );

    expect(state.connection).toBe('closed');
    expect(shown(state)).toEqual([{ key: 'ref-1', text: 'hi', state: 'failed' }]);
  });

  it.each([
    {
      author: 'the viewer',
      self: AUTHOR.userId,
      lines: [{ key: 'ref-1', text: 'hi', state: 'sent' }],
    },
    {
      author: 'someone else',
      self: 'another-user',
      lines: [
        { key: 'ref-1', text: 'hi', state: 'failed' },
        { key: message(7).id, text: 'hi', state: 'sent' },
      ],
    },
  ])(
    'settles a failed line from the replayed backlog only when $author sent it',
    ({ self, lines }) => {
      const state = fold(
        { type: 'sending', ref: 'ref-1', text: 'hi' },
        { type: 'connection', connection: 'closed' },
        { type: 'frame', frame: { type: 'message', message: message(7, 'hi') }, self }
      );

      expect(shown(state)).toEqual(lines);
    }
  );
});
