import { videoSummary } from '@vp/web-testing';
import {
  EMPTY_SESSION,
  nextVideo,
  type PlaybackAction,
  type PlaybackSession,
  playbackReducer,
  previousVideo,
} from '../playback-session';

const a = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c001', title: 'a' });
const b = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c002', title: 'b' });
const c = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c003', title: 'c' });
const other = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c009', title: 'other' });

const playing = (video: typeof a, overrides: Partial<PlaybackSession> = {}): PlaybackSession => ({
  ...EMPTY_SESSION,
  videos: [a, b, c],
  current: { video, startTime: undefined },
  played: [video.id],
  ...overrides,
});

const titles = (videos: readonly { title: string | null }[]) => videos.map(({ title }) => title);

const open = (overrides: Partial<Extract<PlaybackAction, { type: 'open' }>> = {}) =>
  ({
    type: 'open',
    video: a,
    list: undefined,
    playlist: undefined,
    startTime: undefined,
    autoplay: false,
    ...overrides,
  }) satisfies PlaybackAction;

describe('apps/client/web: playback session order', () => {
  it.each([
    { scenario: 'the next video', session: playing(a), next: 'b', previous: undefined },
    {
      scenario: 'the last video with repeat off',
      session: playing(c),
      next: undefined,
      previous: 'b',
    },
    {
      scenario: 'the last video with repeat all, wrapping to the first',
      session: playing(c, { repeat: 'all' }),
      next: 'a',
      previous: 'b',
    },
    {
      scenario: 'the first video with repeat all, wrapping to the last',
      session: playing(a, { repeat: 'all' }),
      next: 'b',
      previous: 'c',
    },
    {
      scenario: 'a video that is not queued',
      session: playing(other),
      next: undefined,
      previous: undefined,
    },
  ])('steps from $scenario', ({ session, next, previous }) => {
    expect(nextVideo(session)?.title).toBe(next);
    expect(previousVideo(session)?.title).toBe(previous);
  });

  it.each([
    {
      scenario: 'a video not played yet',
      session: playing(a, { shuffle: true }),
      random: 0.99,
      next: 'c',
    },
    {
      scenario: 'skipping what played',
      session: playing(a, { shuffle: true, played: [c.id, a.id] }),
      random: 0,
      next: 'b',
    },
    {
      scenario: 'nothing once all played with repeat off',
      session: playing(a, { shuffle: true, played: [b.id, c.id, a.id] }),
      random: 0,
      next: undefined,
    },
    {
      scenario: 'any other video once all played with repeat all',
      session: playing(a, { shuffle: true, repeat: 'all', played: [b.id, c.id, a.id] }),
      random: 0,
      next: 'b',
    },
  ])('shuffles to $scenario', ({ session, random, next }) => {
    expect(nextVideo(session, () => random)?.title).toBe(next);
  });

  it('steps back through what a shuffled queue played', () => {
    expect(previousVideo(playing(a, { shuffle: true, played: [c.id, a.id] }))?.title).toBe('c');
    expect(previousVideo(playing(a, { shuffle: true }))).toBeUndefined();
  });
});

describe('apps/client/web: playback session reducer', () => {
  it.each([
    { move: 'down', id: a.id, toIndex: 2, order: ['b', 'c', 'a'] },
    { move: 'up', id: c.id, toIndex: 0, order: ['c', 'a', 'b'] },
    { move: 'nowhere', id: b.id, toIndex: 1, order: ['a', 'b', 'c'] },
    { move: 'of a video that is not queued', id: other.id, toIndex: 0, order: ['a', 'b', 'c'] },
  ])('moves a video $move', ({ id, toIndex, order }) => {
    const state = playbackReducer(playing(a), { type: 'reorder', id, toIndex });

    expect(titles(state.videos)).toEqual(order);
  });

  it('removes a video', () => {
    expect(titles(playbackReducer(playing(a), { type: 'remove', id: b.id }).videos)).toEqual([
      'a',
      'c',
    ]);
  });

  it.each([
    { scenario: 'a new video', video: other, order: ['a', 'b', 'c', 'other'] },
    { scenario: 'a video that is queued already', video: b, order: ['a', 'b', 'c'] },
  ])('appends $scenario to the queue', ({ video, order }) => {
    expect(titles(playbackReducer(playing(a), { type: 'append', video }).videos)).toEqual(order);
  });

  it.each([
    {
      scenario: 'a new video goes right after the one playing',
      session: playing(a),
      video: other,
      order: ['a', 'other', 'b', 'c'],
    },
    {
      scenario: 'a video later in the queue moves up to it',
      session: playing(a),
      video: c,
      order: ['a', 'c', 'b'],
    },
    {
      scenario: 'a new video goes after a video in the middle',
      session: playing(b),
      video: other,
      order: ['a', 'b', 'other', 'c'],
    },
    {
      scenario: 'the video playing stays where it is',
      session: playing(a),
      video: a,
      order: ['a', 'b', 'c'],
    },
    {
      scenario: 'a new video leads a queue nothing plays in',
      session: { ...EMPTY_SESSION, videos: [b] },
      video: other,
      order: ['other', 'b'],
    },
  ])('plays next: $scenario', ({ session, video, order }) => {
    expect(titles(playbackReducer(session, { type: 'playNext', video }).videos)).toEqual(order);
  });

  it.each([
    {
      scenario: 'seeds the queue with a video opened from nowhere',
      state: { ...EMPTY_SESSION, videos: [b] },
      action: open({ video: other, autoplay: true }),
      queue: ['other', 'b'],
      current: 'other',
      paused: false,
    },
    {
      scenario: 'keeps the queue when the video is in it',
      state: playing(a),
      action: open({ video: b }),
      queue: ['a', 'b', 'c'],
      current: 'b',
      paused: true,
    },
    {
      scenario: 'puts a video outside a hand-built queue at its head',
      state: playing(a),
      action: open({ video: other }),
      queue: ['other', 'a', 'b', 'c'],
      current: 'other',
      paused: true,
    },
    {
      scenario: 'leaves a playlist for a video outside it',
      state: playing(a, { playlistId: 'pl', source: [a.id, b.id, c.id] }),
      action: open({ video: other }),
      queue: ['other'],
      current: 'other',
      paused: true,
    },
    {
      scenario: 'loads the playlist it was opened from',
      state: playing(a),
      action: open({ video: b, list: 'pl', playlist: { id: 'pl', videos: [other, b] } }),
      queue: ['other', 'b'],
      current: 'b',
      paused: true,
    },
    {
      scenario: 'reloads a playlist whose videos changed since it was loaded',
      state: playing(a, { playlistId: 'pl', source: [a.id, b.id, c.id] }),
      action: open({ video: a, list: 'pl', playlist: { id: 'pl', videos: [a, c] } }),
      queue: ['a', 'c'],
      current: 'a',
      paused: true,
    },
    {
      scenario: 'keeps a reordered queue while its playlist is unchanged',
      state: playing(a, {
        playlistId: 'pl',
        source: [a.id, b.id, c.id],
        videos: [c, b, a],
      }),
      action: open({ video: a, list: 'pl', playlist: { id: 'pl', videos: [a, b, c] } }),
      queue: ['c', 'b', 'a'],
      current: 'a',
      paused: true,
    },
    {
      scenario: 'waits for a playlist that is still loading',
      state: playing(a),
      action: open({ video: other, list: 'pl' }),
      queue: ['a', 'b', 'c'],
      current: 'other',
      paused: true,
    },
    {
      scenario: 'leaves the video that already plays alone',
      state: playing(a, { paused: false }),
      action: open({ video: a, startTime: 40 }),
      queue: ['a', 'b', 'c'],
      current: 'a',
      paused: false,
    },
  ])('opens a video: $scenario', ({ state, action, queue, current, paused }) => {
    const next = playbackReducer(state, action);

    expect(titles(next.videos)).toEqual(queue);
    expect(next.current?.video.title).toBe(current);
    expect(next.paused).toBe(paused);
  });

  it('plays the video it goes to, and forgets it on the way back', () => {
    const forward = playbackReducer(playing(a), { type: 'go', video: b });
    expect(forward.played).toEqual([a.id, b.id]);
    expect(forward.paused).toBe(false);

    expect(playbackReducer(forward, { type: 'go', video: a, back: true }).played).toEqual([a.id]);
  });

  it('closes playback and keeps the queue', () => {
    const closed = playbackReducer(playing(a, { paused: false }), { type: 'close' });

    expect(closed.current).toBeUndefined();
    expect(titles(closed.videos)).toEqual(['a', 'b', 'c']);
  });
});
