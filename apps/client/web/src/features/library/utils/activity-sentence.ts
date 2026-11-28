import { assertNever } from '@kit/result';
import type { PlaylistActivityView, PlaylistView } from '@vp/api-contracts';
import type { Translator } from '#app/lib/messages';

type Tr = Translator['tOr'];

/** The title of the video an entry names, by its item or its video, while the playlist still shows it. */
function titleIn(
  items: PlaylistView['items'],
  { itemId, videoId }: { itemId?: string; videoId?: string | null }
): string | null {
  const item = items.find((candidate) => candidate.id === itemId || candidate.videoId === videoId);
  return item?.video.title ?? null;
}

/** One sentence for one entry of a playlist's activity, in the reader's words, naming who did it. */
export function activitySentence(
  entry: PlaylistActivityView,
  items: PlaylistView['items'],
  tOr: Tr
): string {
  const name = entry.actor?.displayName ?? tOr('playlistPeople.someone', {}, '');
  const aVideo = tOr('playlistPeople.aVideo', {}, '');
  const titleOf = (target: { itemId?: string; videoId?: string | null }) =>
    titleIn(items, target) ?? aVideo;

  switch (entry.action) {
    case 'item_added':
      return tOr('playlistPeople.itemAdded', { name, title: titleOf(entry.target) }, '');
    case 'item_removed':
      return tOr(
        'playlistPeople.itemRemoved',
        { name, title: entry.target.title ?? titleOf(entry.target) },
        ''
      );
    case 'auto_removed':
      return tOr('playlistPeople.autoRemoved', { title: titleOf(entry.target) }, '');
    case 'items_reordered':
      return tOr('playlistPeople.itemsReordered', { name, count: entry.target.count }, '');
    case 'note_edited':
      return tOr('playlistPeople.noteEdited', { name, title: titleOf(entry.target) }, '');
    case 'section_added':
      return tOr('playlistPeople.sectionAdded', { name, title: entry.target.title }, '');
    case 'collaborator_added':
      return entry.actorUserId === entry.target.userId
        ? tOr('playlistPeople.collaboratorJoined', { name, role: entry.target.role }, '')
        : tOr('playlistPeople.collaboratorAdded', { name, role: entry.target.role }, '');
    case 'collaborator_removed':
      return entry.actorUserId === entry.target.userId
        ? tOr('playlistPeople.collaboratorLeft', { name }, '')
        : tOr('playlistPeople.collaboratorRemoved', { name }, '');
    case 'role_changed':
      return tOr('playlistPeople.roleChanged', { name, role: entry.target.role }, '');
    case 'settings_changed':
      return tOr('playlistPeople.settingsChanged', { name }, '');
    case 'restored':
      return tOr('playlistPeople.itemRestored', { name, title: titleOf(entry.target) }, '');
    default:
      return assertNever(entry, 'PlaylistActivityAction');
  }
}
