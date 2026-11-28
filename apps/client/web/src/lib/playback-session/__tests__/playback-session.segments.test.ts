import { videoSummary } from '@vp/web-testing';
import {
  EMPTY_SESSION,
  type PlaybackAction,
  type PlaybackSession,
  playbackReducer,
} from '../playback-session';

const a = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c001', title: 'a' });
const b = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c002', title: 'b' });
const other = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000c009', title: 'other' });

const aSegment = { startMs: 30_000, endMs: 105_000 };
const bSegment = { startMs: 0, endMs: 12_000 };

const playingPlaylist = (segments: PlaybackSession['segments']): PlaybackSession => ({
  ...EMPTY_SESSION,
  videos: [a, b],
  playlistId: 'pl',
  source: [a.id, b.id],
  segments,
  current: { video: a, startTime: undefined, shareToken: undefined },
  played: [a.id],
});

const open = (overrides: Partial<Extract<PlaybackAction, { type: 'open' }>> = {}) =>
  ({
    type: 'open',
    video: a,
    list: undefined,
    playlist: undefined,
    startTime: undefined,
    autoplay: false,
    shareToken: undefined,
    ...overrides,
  }) satisfies PlaybackAction;

describe('apps/client/web: playback session segments', () => {
  it.each([
    {
      scenario: 'loading a playlist takes its segments',
      state: EMPTY_SESSION,
      action: open({
        list: 'pl',
        playlist: { id: 'pl', videos: [a, b], segments: { [a.id]: aSegment } },
      }),
      segments: { [a.id]: aSegment },
    },
    {
      scenario: 'reloading a changed playlist replaces them',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({
        list: 'pl',
        playlist: { id: 'pl', videos: [a, b, other], segments: { [b.id]: bSegment } },
      }),
      segments: { [b.id]: bSegment },
    },
    {
      scenario: 'a playlist without segments clears them',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({ list: 'pl', playlist: { id: 'pl', videos: [b, a], segments: {} } }),
      segments: {},
    },
    {
      scenario: 'an unchanged playlist keeps them',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({
        list: 'pl',
        playlist: { id: 'pl', videos: [a, b], segments: { [a.id]: aSegment } },
      }),
      segments: { [a.id]: aSegment },
    },
    {
      scenario: 'the same videos with an edited segment take the new range',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({
        list: 'pl',
        playlist: { id: 'pl', videos: [a, b], segments: { [a.id]: { startMs: 0, endMs: 60_000 } } },
      }),
      segments: { [a.id]: { startMs: 0, endMs: 60_000 } },
    },
    {
      scenario: 'a video opened inside the playlist keeps them',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({ video: b }),
      segments: { [a.id]: aSegment },
    },
    {
      scenario: 'leaving the playlist for a video outside it clears them',
      state: playingPlaylist({ [a.id]: aSegment }),
      action: open({ video: other }),
      segments: {},
    },
  ])('on open, $scenario', ({ state, action, segments }) => {
    expect(playbackReducer(state, action).segments).toEqual(segments);
  });

  it('starts with none', () => {
    expect(EMPTY_SESSION.segments).toEqual({});
  });
});
