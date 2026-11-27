import { type Result, isErr, isOk } from '@kit/result';
import type { SeatedPlaylist } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ADMIN, OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import {
  type PlaylistAction,
  decidePlaylistAction,
  decidePlaylistCoverUpload,
  decidePlaylistDelete,
  decidePlaylistUpdate,
} from '../manage-playlist.rule';

const playlist = aPlaylist();
const watchLater = aPlaylist({ id: 'wl-1', title: 'Watch Later', isSystem: true });
const smart = aPlaylist({ rules: { match: 'all', conditions: [], sort: 'newest', limit: 50 } });
const context = { seated: 0, holdsCoverVideo: false, coverImageKey: null };

type Decide = (
  actor: UserContext | null,
  target?: SeatedPlaylist | null
) => Result<unknown, { code: string }>;

const DECISIONS: Record<'update' | 'delete' | 'items' | 'cover', Decide> = {
  update: (actor: UserContext | null, target: SeatedPlaylist | null = playlist) =>
    decidePlaylistUpdate({
      actor,
      playlist: target,
      playlistId: target?.id ?? playlist.id,
      patch: { title: 'New' },
      context,
    }),
  delete: (actor: UserContext | null, target: SeatedPlaylist | null = playlist) =>
    decidePlaylistDelete({ actor, playlist: target, playlistId: target?.id ?? playlist.id }),
  items: (actor: UserContext | null, target: SeatedPlaylist | null = playlist) =>
    decidePlaylistAction(
      { actor, playlist: target, playlistId: target?.id ?? playlist.id },
      'manageItems'
    ),
  cover: (actor: UserContext | null, target: SeatedPlaylist | null = playlist) =>
    decidePlaylistCoverUpload({ actor, playlist: target, playlistId: target?.id ?? playlist.id }),
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

  it.each<Decision>(['update', 'delete', 'cover'])(
    'refuses to %s the system playlist, even for its owner',
    (decision) => {
      const result = DECISIONS[decision](OWNER, watchLater);

      expect(isErr(result) && result.error.code).toBe(ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE);
    }
  );

  it('lets the owner curate the items of the system playlist', () => {
    expect(isOk(DECISIONS.items(OWNER, watchLater))).toBe(true);
  });

  it('lets the owner of the system playlist turn on removing watched videos', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist: watchLater,
      playlistId: watchLater.id,
      patch: { autoRemoveWatched: true },
      context,
    });

    expect(isOk(result) && result.value).toEqual({ autoRemoveWatched: true });
  });

  it.each<{ action: PlaylistAction; code: string | null }>([
    { action: 'addItem', code: ErrorCodes.PLAYLIST_IS_SMART },
    { action: 'removeItem', code: ErrorCodes.PLAYLIST_IS_SMART },
    { action: 'manageItems', code: ErrorCodes.PLAYLIST_IS_SMART },
    { action: 'restoreItem', code: ErrorCodes.PLAYLIST_IS_SMART },
    { action: 'manageCollaborators', code: null },
    { action: 'delete', code: null },
  ])('on a smart playlist the owner may $action: $code', ({ action, code }) => {
    const result = decidePlaylistAction(
      { actor: OWNER, playlist: smart, playlistId: smart.id },
      action
    );

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });

  it('still answers a stranger on a private smart playlist with PLAYLIST_NOT_FOUND', () => {
    const result = decidePlaylistAction(
      { actor: STRANGER, playlist: smart, playlistId: smart.id },
      'addItem'
    );

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
  });

  it('hands back the normalized patch', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      patch: { title: '  Road trip 2 ', visibility: 'public' },
      context,
    });

    expect(isOk(result) && result.value).toEqual({ title: 'Road trip 2', visibility: 'public' });
  });

  it('passes the kind of an edit through', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      patch: { kind: 'series' },
      context,
    });

    expect(isOk(result) && result.value).toEqual({ kind: 'series' });
  });

  it('rejects a blank title in an edit', () => {
    const result = decidePlaylistUpdate({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      patch: { title: '  ' },
      context,
    });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'title',
    });
  });

  const seated = (role: 'editor' | 'contributor') =>
    aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: role });

  it.each<{
    role: 'editor' | 'contributor';
    action: PlaylistAction;
    addedBy?: string;
    code: string | null;
  }>([
    { role: 'editor', action: 'addItem', code: null },
    { role: 'editor', action: 'removeItem', addedBy: OWNER.id, code: null },
    { role: 'editor', action: 'manageItems', code: null },
    { role: 'editor', action: 'readActivity', code: null },
    { role: 'editor', action: 'manageCollaborators', code: ErrorCodes.FORBIDDEN },
    { role: 'editor', action: 'restoreItem', code: ErrorCodes.FORBIDDEN },
    { role: 'editor', action: 'delete', code: ErrorCodes.FORBIDDEN },
    { role: 'contributor', action: 'addItem', code: null },
    { role: 'contributor', action: 'removeItem', addedBy: STRANGER.id, code: null },
    { role: 'contributor', action: 'removeItem', addedBy: OWNER.id, code: ErrorCodes.FORBIDDEN },
    { role: 'contributor', action: 'manageItems', code: ErrorCodes.FORBIDDEN },
    { role: 'contributor', action: 'readActivity', code: null },
  ])('an $role may $action (added by $addedBy): $code', ({ role, action, addedBy, code }) => {
    const target = seated(role);
    const result = decidePlaylistAction(
      { actor: STRANGER, playlist: target, playlistId: target.id },
      action,
      addedBy === undefined ? undefined : { addedBy }
    );

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });

  it.each([
    { role: 'editor' as const, patch: { title: 'New', description: 'Why' }, code: null },
    {
      role: 'editor' as const,
      patch: { visibility: 'public' as const },
      code: ErrorCodes.FORBIDDEN,
    },
    { role: 'editor' as const, patch: { kind: 'series' as const }, code: ErrorCodes.FORBIDDEN },
    { role: 'contributor' as const, patch: { title: 'New' }, code: ErrorCodes.FORBIDDEN },
    {
      role: 'editor' as const,
      patch: { coverUploadId: 'upload-1' },
      code: ErrorCodes.FORBIDDEN,
    },
  ])('lets an $role change $patch: $code', ({ role, patch, code }) => {
    const target = seated(role);
    const result = decidePlaylistUpdate({
      actor: STRANGER,
      playlist: target,
      playlistId: target.id,
      patch,
      context,
    });

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });
});
