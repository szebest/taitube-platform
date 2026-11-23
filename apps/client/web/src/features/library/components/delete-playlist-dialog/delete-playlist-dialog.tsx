import { Button } from '@kit/ui';
import { useDeletePlaylist } from '#app/features/library/hooks/use-delete-playlist';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal, useUrlModal } = urlModals;

/** `?modal=delete-playlist&playlistId=`: asks first, because a deleted playlist and its order do not come back. */
export function DeletePlaylistDialog() {
  const { tOr } = useT();
  const cancel = tOr('ui.cancel', {}, '');
  const { params } = useUrlModal('delete-playlist');
  const { mutate, isPending } = useDeletePlaylist();

  return (
    <UrlModal.Root id="delete-playlist">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('library.deletePlaylistTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>{tOr('library.deletePlaylistBody', {}, '')}</UrlModal.Description>
        <UrlModal.Footer>
          <UrlModal.Close asChild>
            <Button variant="ghost">{cancel}</Button>
          </UrlModal.Close>
          <Button
            variant="solid"
            tone="danger"
            loading={isPending}
            onClick={() => params && mutate(params.playlistId)}
          >
            {tOr('library.deletePlaylist', {}, '')}
          </Button>
        </UrlModal.Footer>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
