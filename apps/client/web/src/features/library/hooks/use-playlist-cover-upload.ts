import { useMutation } from '@tanstack/react-query';
import { useApi, useUserEvent } from '@vp/queries';
import { useState } from 'react';
import { type CoverChoice, uploadPlaylistCover } from '../api/upload-playlist-cover';
import { useSavePlaylistSettings } from './use-save-playlist-settings';

export type CoverUploadStatus = 'idle' | 'working' | 'ready' | 'failed';

type Job = { status: CoverUploadStatus; uploadId: string | null };

const IDLE: Job = { status: 'idle', uploadId: null };

/**
 * One custom cover, from the presigned PUT to the edit that shows it: the playlist takes the upload
 * once `channel.image.ready` names it, so `working` lasts until that edit is saved.
 */
export function usePlaylistCoverUpload(playlistId: string) {
  const api = useApi();
  const save = useSavePlaylistSettings(playlistId);
  const [job, setJob] = useState(IDLE);

  const upload = useMutation({
    mutationFn: (choice: CoverChoice) =>
      uploadPlaylistCover(api, playlistId, choice, (uploadId) =>
        setJob({ status: 'working', uploadId })
      ),
    onMutate: () => setJob({ status: 'working', uploadId: null }),
    onError: () => setJob((current) => ({ ...current, status: 'failed' })),
  });

  useUserEvent('channel.image.ready', ({ payload: { uploadId } }) => {
    if (uploadId !== job.uploadId) return;
    save.mutate(
      { coverUploadId: uploadId },
      {
        onSuccess: () => setJob({ status: 'ready', uploadId }),
        onError: () => setJob({ status: 'failed', uploadId }),
      }
    );
  });

  useUserEvent('channel.image.failed', ({ payload: { uploadId } }) => {
    if (uploadId === job.uploadId) setJob({ status: 'failed', uploadId });
  });

  return { status: job.status, start: (choice: CoverChoice) => upload.mutate(choice) };
}
