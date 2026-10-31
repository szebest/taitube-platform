import { useT } from '@vp/intl-react';

import { urlModals } from '#app/features/url-modal/registry';

import { NewPlaylistForm } from './new-playlist-form';

const { UrlModal, useUrlModal } = urlModals;

/** `?modal=new-playlist`: a playlist with no video in it yet. */
export function NewPlaylistDialog() {
  const { tOr } = useT();
  const { isOpen, close } = useUrlModal('new-playlist');

  return (
    <UrlModal.Root id="new-playlist">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('library.newPlaylist', {}, '')}</UrlModal.Title>
        <UrlModal.Description>{tOr('library.newPlaylistBody', {}, '')}</UrlModal.Description>
        <UrlModal.Body>
          {isOpen && <NewPlaylistForm onCreated={close} onCancel={close} />}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
