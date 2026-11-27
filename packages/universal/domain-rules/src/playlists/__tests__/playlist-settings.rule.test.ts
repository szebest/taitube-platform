import { err, ok } from '@kit/result';
import type { PlaylistPatch, SmartPlaylistRules } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { aPlaylist } from '../../__tests__/entities';
import {
  type PlaylistSettingsContext,
  coverVideoOf,
  decidePlaylistSettings,
} from '../playlist-settings.rule';

const RULES: SmartPlaylistRules = { match: 'any', conditions: [], sort: 'popular', limit: 10 };
const ALONE: PlaylistSettingsContext = { seated: 0, holdsCoverVideo: true };

describe('@vp/domain-rules: decidePlaylistSettings', () => {
  it.each<{
    scenario: string;
    playlist: ReturnType<typeof aPlaylist>;
    patch: PlaylistPatch;
    context?: PlaylistSettingsContext;
    code: string;
  }>([
    {
      scenario: 'rules on a plain playlist',
      playlist: aPlaylist(),
      patch: { rules: RULES },
      code: ErrorCodes.PLAYLIST_NOT_SMART,
    },
    {
      scenario: 'a smart series',
      playlist: aPlaylist({ rules: RULES }),
      patch: { kind: 'series' },
      code: ErrorCodes.PLAYLIST_IS_SMART,
    },
    {
      scenario: 'removing watched videos from a smart list',
      playlist: aPlaylist({ rules: RULES }),
      patch: { autoRemoveWatched: true },
      code: ErrorCodes.PLAYLIST_IS_SMART,
    },
    {
      scenario: 'removing watched videos with a collaborator',
      playlist: aPlaylist(),
      patch: { autoRemoveWatched: true },
      context: { seated: 1, holdsCoverVideo: false },
      code: ErrorCodes.PLAYLIST_HAS_COLLABORATORS,
    },
    {
      scenario: 'an item cover of a video it does not hold',
      playlist: aPlaylist(),
      patch: { coverVideoId: 'video-9' },
      context: { seated: 0, holdsCoverVideo: false },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'an item cover with no video',
      playlist: aPlaylist(),
      patch: { coverMode: 'item' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a custom cover with no image',
      playlist: aPlaylist(),
      patch: { coverMode: 'custom' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ playlist, patch, context = ALONE, code }) => {
    expect(decidePlaylistSettings(playlist, patch, context)).toMatchObject(err({ code }));
  });

  it.each<{
    scenario: string;
    playlist: ReturnType<typeof aPlaylist>;
    patch: PlaylistPatch;
    settings: PlaylistPatch;
  }>([
    { scenario: 'nothing', playlist: aPlaylist(), patch: { title: 'x' }, settings: {} },
    {
      scenario: 'new rules',
      playlist: aPlaylist({ rules: RULES }),
      patch: { rules: { ...RULES, limit: 20 } },
      settings: { rules: { ...RULES, limit: 20 } },
    },
    {
      scenario: 'removing watched videos when alone',
      playlist: aPlaylist(),
      patch: { autoRemoveWatched: true },
      settings: { autoRemoveWatched: true },
    },
    {
      scenario: 'turning it off on a smart list',
      playlist: aPlaylist({ rules: RULES }),
      patch: { autoRemoveWatched: false },
      settings: { autoRemoveWatched: false },
    },
    {
      scenario: 'a cover video, which picks the item mode',
      playlist: aPlaylist(),
      patch: { coverVideoId: 'video-1' },
      settings: { coverMode: 'item', coverVideoId: 'video-1' },
    },
    {
      scenario: 'the item mode over the video held',
      playlist: aPlaylist({ coverVideoId: 'video-2' }),
      patch: { coverMode: 'item' },
      settings: { coverMode: 'item', coverVideoId: 'video-2' },
    },
    {
      scenario: 'back to the mosaic, forgetting the video',
      playlist: aPlaylist({ coverMode: 'item', coverVideoId: 'video-2' }),
      patch: { coverMode: 'auto' },
      settings: { coverMode: 'auto', coverVideoId: null },
    },
    {
      scenario: 'a custom cover over an uploaded image',
      playlist: aPlaylist({ customThumbnailKey: 'playlists/p/cover.webp' }),
      patch: { coverMode: 'custom' },
      settings: { coverMode: 'custom', coverVideoId: null },
    },
  ])('decides $scenario', ({ playlist, patch, settings }) => {
    expect(decidePlaylistSettings(playlist, patch, ALONE)).toEqual(ok(settings));
  });
});

describe('@vp/domain-rules: coverVideoOf', () => {
  it.each([
    { scenario: 'the one named', patch: { coverVideoId: 'video-1' }, expected: 'video-1' },
    { scenario: 'a cleared one', patch: { coverVideoId: null }, expected: null },
    { scenario: 'the one held', patch: {}, expected: 'video-2' },
  ])('answers $scenario', ({ patch, expected }) => {
    expect(coverVideoOf(aPlaylist({ coverVideoId: 'video-2' }), patch)).toBe(expected);
  });
});
