import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { RecordWatchProgressBody } from '@vp/api-contracts';
import { useAccount, useApi } from '@vp/queries';
import { useRef } from 'react';

import type { PlaybackEnd, PlaybackProgress } from '#app/features/player';
import { useAccountPreference } from '#app/features/settings/hooks/use-account-preference';

import { libraryKeys } from '../api/library-queries';

const HEARTBEAT_EVERY_SECONDS = 10;

function recordProgressMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: (body: RecordWatchProgressBody) => api.watchHistory.recordWatchProgress({ body }),
    onSuccess: (_progress, _body, _context, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.history(), refetchType: 'none' }),
  });
}

export interface ProgressWriter {
  onTimeUpdate: (progress: PlaybackProgress) => void;
  onPause: (progress: PlaybackProgress) => void;
  onEnded: (end: PlaybackEnd) => void;
}

/**
 * Saves where the signed-in viewer is in a video: a heartbeat every ten seconds of playhead, and a
 * write-through on pause and at the end. Nothing is saved for a guest or while history is paused.
 */
export function useProgressWriter(videoId: string): ProgressWriter {
  const api = useApi();
  const account = useAccount();
  const [paused] = useAccountPreference('privacy', 'historyPaused');
  const { mutate } = useMutation(recordProgressMutationOptions(api));
  const lastBeat = useRef<{ videoId: string; seconds: number }>(undefined);

  const record = (seconds: number, duration: number, reason: RecordWatchProgressBody['reason']) => {
    const durationSeconds = Math.floor(duration);
    if (!account || paused || !Number.isFinite(duration) || durationSeconds < 1) return;

    lastBeat.current = { videoId, seconds };
    mutate({ videoId, progressSeconds: Math.floor(seconds), durationSeconds, reason });
  };

  return {
    onTimeUpdate: ({ currentTime, duration }) => {
      const beat = lastBeat.current;
      const due =
        beat?.videoId !== videoId ||
        Math.abs(currentTime - beat.seconds) >= HEARTBEAT_EVERY_SECONDS;
      if (due) record(currentTime, duration, 'heartbeat');
    },
    onPause: ({ currentTime, duration }) => record(currentTime, duration, 'pause'),
    onEnded: ({ duration }) => record(duration, duration, 'ended'),
  };
}
