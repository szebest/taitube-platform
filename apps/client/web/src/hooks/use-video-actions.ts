import { useCan } from '@vp/permissions-react';

import { urlModals } from '#app/features/url-modal/registry';

/** What a viewer can do to a video from a card; an action left out is not offered. */
export interface VideoActions {
  save?: () => void;
  enqueue?: () => void;
}

/**
 * Save opens the save-to-playlist dialog and is offered to a member only. Enqueue waits for the
 * player queue (73) and is never offered until then.
 */
export function useVideoActions(videoId: string): VideoActions {
  const canSave = useCan('create', 'Playlist');
  const { open } = urlModals.useUrlModal('save-to-playlist');

  return { save: canSave ? () => open({ videoId }) : undefined };
}
