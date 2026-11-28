import { assertNever } from '@kit/result';
import type { ApiClient } from '@vp/api-client';
import type { PlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

/** A video item takes a note and a segment, a section its title. */
type PlaylistItemEdit =
  | {
      kind: 'video';
      itemId: string;
      note: string | null;
      startMs: number | null;
      endMs: number | null;
    }
  | { kind: 'section'; itemId: string; title: string };

function applyEdit(playlist: PlaylistView, edit: PlaylistItemEdit): PlaylistView {
  switch (edit.kind) {
    case 'video': {
      const { itemId, note, startMs, endMs } = edit;
      return {
        ...playlist,
        items: playlist.items.map((item) =>
          item.id === itemId ? { ...item, note, startMs, endMs } : item
        ),
      };
    }
    case 'section':
      return {
        ...playlist,
        sections: playlist.sections.map((section) =>
          section.id === edit.itemId ? { ...section, title: edit.title } : section
        ),
      };
    default:
      return assertNever(edit, 'PlaylistItemEdit');
  }
}

function bodyOf(edit: PlaylistItemEdit) {
  switch (edit.kind) {
    case 'video':
      return { note: edit.note, startMs: edit.startMs, endMs: edit.endMs };
    case 'section':
      return { title: edit.title };
    default:
      return assertNever(edit, 'PlaylistItemEdit');
  }
}

function editItemMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (edit: PlaylistItemEdit) =>
      api.playlistItems.editPlaylistItem({
        params: { id: playlistId, itemId: edit.itemId },
        body: bodyOf(edit),
      }),
    edit: applyEdit,
    invalidate: [libraryKeys.playlist(playlistId)],
  });
}

/** Annotates a video item or renames a section: the list shows it at once and a refusal undoes it. */
export function useEditPlaylistItem(playlistId: string) {
  const api = useApi();
  return useListMutation(editItemMutationOptions(api, playlistId));
}
