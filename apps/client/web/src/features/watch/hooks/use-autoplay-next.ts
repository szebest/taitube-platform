import { useNavigate } from '@tanstack/react-router';

import { useOnPlayerEnded } from '#app/features/player';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';

type Identified = Readonly<{ id: string }>;

/** Opens the video after the current one in the queue, or the first recommendation, once the playing video ends. */
export function useAutoplayNext({
  queue,
  recommended,
  currentId,
}: {
  queue: readonly Identified[];
  recommended: readonly Identified[];
  currentId: string;
}) {
  const [autoplayNext] = usePlaybackPreference('autoplayNext');
  const navigate = useNavigate();

  const position = queue.findIndex(({ id }) => id === currentId);
  const nextId = (position >= 0 ? queue[position + 1] : undefined)?.id ?? recommended[0]?.id;

  useOnPlayerEnded(() => {
    if (!autoplayNext || nextId === undefined) {
      return;
    }

    navigate({ to: '/watch/$videoId', params: { videoId: nextId }, state: { autoplay: true } });
  });
}
