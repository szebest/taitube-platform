import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useApi, videoQueryOptions } from '@vp/queries';
import { libraryKeys } from '#app/features/videos/api/library-queries';
import { videoScreeningQueryOptions } from '#app/features/videos/api/video-screening';

/** Appeals a screening rejection with a message: the video goes back on hold, so what the page shows is read again. */
export function useAppealScreening(videoId: string) {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (message: string) =>
        api.screening.appealScreening({ params: { id: videoId }, body: { message } }),
      onSuccess: (screening, _message, _snapshot, { client }) => {
        client.setQueryData(videoScreeningQueryOptions(api, videoId).queryKey, screening);
      },
      onSettled: (_data, _error, _message, _snapshot, { client }) =>
        Promise.all([
          client.invalidateQueries({ queryKey: videoQueryOptions(api, videoId).queryKey }),
          client.invalidateQueries({ queryKey: libraryKeys.all }),
        ]),
    })
  );
}
