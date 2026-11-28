import { type Result, isErr } from '@kit/result';
import type { SeatedPlaylist, SmartPlaylistRules } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import {
  decidePlaylistFollow,
  decidePlaylistFork,
  decidePlaylistFreeze,
  decidePlaylistPin,
  decidePlaylistShare,
  decidePlaylistStatsRead,
} from '../playlist-library.rule';

const RULES: SmartPlaylistRules = { match: 'all', conditions: [], sort: 'newest', limit: 10 };
const publicList = aPlaylist({ visibility: 'public' });
const ACTORS = { owner: OWNER, stranger: STRANGER, guest: null };

type Decide = (
  actor: UserContext | null,
  playlist: SeatedPlaylist
) => Result<unknown, { code: string }>;

const input = (actor: UserContext | null, playlist: SeatedPlaylist) => ({
  actor,
  playlist,
  playlistId: playlist.id,
});

const DECISIONS = {
  pin: (actor, playlist) => decidePlaylistPin(input(actor, playlist)),
  follow: (actor, playlist) => decidePlaylistFollow(input(actor, playlist)),
  fork: (actor, playlist) => decidePlaylistFork(input(actor, playlist)),
  freeze: (actor, playlist) => decidePlaylistFreeze(input(actor, playlist)),
  stats: (actor, playlist) => decidePlaylistStatsRead(input(actor, playlist)),
  share: (actor, playlist) => decidePlaylistShare(input(actor, playlist)),
} satisfies Record<string, Decide>;

function codeOf(result: Result<unknown, { code: string }>): string | null {
  return isErr(result) ? result.error.code : null;
}

describe('@vp/domain-rules: the library actions on a playlist', () => {
  it.each<{
    decision: keyof typeof DECISIONS;
    who: keyof typeof ACTORS;
    playlist: SeatedPlaylist;
    code: string | null;
  }>([
    { decision: 'pin', who: 'owner', playlist: publicList, code: null },
    { decision: 'pin', who: 'stranger', playlist: publicList, code: ErrorCodes.FORBIDDEN },
    { decision: 'follow', who: 'stranger', playlist: publicList, code: null },
    { decision: 'follow', who: 'owner', playlist: publicList, code: ErrorCodes.FORBIDDEN },
    { decision: 'follow', who: 'guest', playlist: publicList, code: ErrorCodes.UNAUTHORIZED },
    {
      decision: 'follow',
      who: 'stranger',
      playlist: aPlaylist(),
      code: ErrorCodes.PLAYLIST_NOT_FOUND,
    },
    { decision: 'fork', who: 'stranger', playlist: publicList, code: null },
    { decision: 'fork', who: 'owner', playlist: publicList, code: null },
    { decision: 'fork', who: 'guest', playlist: publicList, code: ErrorCodes.UNAUTHORIZED },
    {
      decision: 'freeze',
      who: 'stranger',
      playlist: publicList,
      code: ErrorCodes.PLAYLIST_NOT_SMART,
    },
    {
      decision: 'freeze',
      who: 'stranger',
      playlist: aPlaylist({ visibility: 'public', rules: RULES }),
      code: null,
    },
    { decision: 'stats', who: 'owner', playlist: publicList, code: null },
    { decision: 'stats', who: 'stranger', playlist: publicList, code: ErrorCodes.FORBIDDEN },
    {
      decision: 'stats',
      who: 'stranger',
      playlist: aPlaylist(),
      code: ErrorCodes.PLAYLIST_NOT_FOUND,
    },
    {
      decision: 'stats',
      who: 'stranger',
      playlist: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'editor' }),
      code: ErrorCodes.FORBIDDEN,
    },
    { decision: 'share', who: 'owner', playlist: aPlaylist(), code: null },
    {
      decision: 'share',
      who: 'stranger',
      playlist: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'editor' }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      decision: 'share',
      who: 'owner',
      playlist: aPlaylist({ isSystem: true }),
      code: ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    },
  ])('$decision by the $who: $code', ({ decision, who, playlist, code }) => {
    expect(codeOf(DECISIONS[decision](ACTORS[who], playlist))).toBe(code);
  });
});
