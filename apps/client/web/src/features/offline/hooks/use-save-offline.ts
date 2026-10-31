import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { type Result, ok } from '@vp/result';
import { removeSavedVideo } from '../saved/remove-saved-video';
import { saveVideoOffline } from '../saved/save-video-offline';
import type { SaveFailure } from '../saved/saved-video';
import { savedVideoKeys, useSavedVideos } from './use-saved-videos';

export type SaveToggled = Result<'saved' | 'removed', SaveFailure>;

/** Whether `video` is saved, and a toggle that saves or removes it and says what happened. */
export function useSaveOffline(video: Video) {
  const queryClient = useQueryClient();
  const saved = useSavedVideos().some(({ id }) => id === video.id);

  const { mutateAsync, isPending } = useMutation({
    networkMode: 'always',
    mutationFn: async (): Promise<SaveToggled> => {
      if (saved) {
        const removed = await removeSavedVideo(window.caches, video.id);
        return removed.ok ? ok('removed') : removed;
      }
      const stored = await saveVideoOffline(
        {
          storage: window.caches,
          fetch: window.fetch.bind(window),
          origin: window.location.origin,
        },
        video
      );
      return stored.ok ? ok('saved') : stored;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedVideoKeys.all }),
  });

  return { saved, pending: isPending, toggle: mutateAsync };
}
