import type { Playlist } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { isErr, isOk } from '@vp/result';
import { ADMIN, OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import {
  decidePlaylistDelete,
  decidePlaylistItemsChange,
  decidePlaylistUpdate,
} from '../manage-playlist.rule';

const playlist = aPlaylist();
const watchLater = aPlaylist({ id: 'wl-1', title: 'Watch Later', isSystem: true });

const DECISIONS = {
  update: (actor: UserContext | null, target: Playlist | null = playlist) =>
    decidePlaylistUpdate({
      actor,
      playlist: target,
      playlistId: target?.id ?? playlist.id,
      patch: { title: 'New' },
    }),
  delete: (actor: UserContext | null, target: Playlist | null = playlist) =>
    decidePlaylistDelete({ actor, playlist: target, playlistId: target?.id ?? playlist.id }),
  items: (actor: UserContext | null, target: Playlist | null = playlist) =>
    decidePlaylistItemsChange({ actor, playlist: target, playlistId: target?.id ?? playlist.id }),
};

type Decision = keyof typeof DECISIONS;
const ALL = Object.keys(DECISIONS) as Decision[];

describe('@vp/domain-rules: playlist management', () => {
  it.each(
    ALL.flatMap((decision) => [
      { decision, scenario: 'the owner', actor: OWNER },
      { decision, scenario: 'an admin', actor: ADMIN },
    ])
  )('lets $scenario $decision', ({ decision, actor }) => {
    expect(isOk(DECISIONS[decision](actor))).toBe(true);
  });

  it.each(
    ALL.flatMap((decision) => [
      {
        decision,
        scenario: 'a stranger on a private playlist',
        actor: STRANGER,
        target: playlist,
        code: ErrorCodes.PLAYLIST_NOT_FOUND,
      },
      {
        decision,
        scenario: 'an anonymous caller on a private playlist',
        actor: null,
        target: playlist,
        code: ErrorCodes.PLAYLIST_NOT_FOUND,
      },
      {
        decision,
        scenario: 'a stranger on a public playlist',
        actor: STRANGER,
        target: aPlaylist({ visibility: 'public' }),
        code: ErrorCodes.FORBIDDEN,
      },
      {
        decision,
        scenario: 'an anonymous caller on a public playlist',
        actor: null,
        target: aPlaylist({ visibility: 'public' }),
        code: ErrorCodes.UNAUTHORIZED,
      },
    ])
  )('refuses $scenario to $decision with $code', ({ decision, actor, target, code }) => {
    const result = DECISIONS[decision](actor, target);

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each(ALL)('reports an absent playlist as PLAYLIST_NOT_FOUND on %s', (decision) => {
    const result = DECISIONS[decision](OWNER, null);

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
  });

  it.each<Decision>(['update', 'delete'])(
    'refuses to %s the system playlist, even for its owner',
    (decision) => {
      const result = DECISIONS[decision](OWNER, watchLater);

      expect(isErr(result) && result.error.code).toBe(ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE);
    }
  );

  it('lets the owner curate the items of the system playlist', () => {
    expect(isOk(DECISIONS.items(OWNER, watchLater))).toBe(true);
  });

  it('hands back the normalized patch', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      patch: { title: '  Road trip 2 ', visibility: 'public' },
    });

    expect(isOk(result) && result.value).toEqual({ title: 'Road trip 2', visibility: 'public' });
  });

  it('rejects a blank title in an edit', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      patch: { title: '  ' },
    });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'title',
    });
  });
});
