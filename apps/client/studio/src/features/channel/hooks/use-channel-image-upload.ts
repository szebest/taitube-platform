import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ImageCrops } from '@vp/domain';
import { SESSION_KEY, useApi, useUserEvent } from '@vp/queries';
import { useState } from 'react';
import type { ImageCropperKind } from '#app/components/image/image-cropper';
import { uploadChannelImage } from '#app/utils/upload-channel-image';

export type ChannelImageJobStatus = 'idle' | 'working' | 'ready' | 'failed';

export interface ChannelImageChoice {
  file: File;
  size: { width: number; height: number };
  crops: ImageCrops;
}

type Job = { status: ChannelImageJobStatus; uploadId: string | null };

const IDLE: Job = { status: 'idle', uploadId: null };

/**
 * One upload of a channel's picture or banner, from the presigned PUT to the job's end. The channel
 * keeps its image until `channel.image.ready` arrives, so `working` lasts until the event does.
 */
export function useChannelImageUpload(kind: ImageCropperKind) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [job, setJob] = useState(IDLE);

  const upload = useMutation({
    mutationFn: (choice: ChannelImageChoice) =>
      uploadChannelImage(api, { kind, ...choice }, (uploadId) =>
        setJob({ status: 'working', uploadId })
      ),
    onMutate: () => setJob({ status: 'working', uploadId: null }),
    onError: () => setJob((current) => ({ ...current, status: 'failed' })),
  });

  useUserEvent('channel.image.ready', ({ payload }) => {
    if (payload.uploadId !== job.uploadId) return;
    setJob({ status: 'ready', uploadId: payload.uploadId });
    void queryClient.invalidateQueries({ queryKey: ['channel', 'acting'] });
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  });

  useUserEvent('channel.image.failed', ({ payload }) => {
    if (payload.uploadId === job.uploadId) setJob({ status: 'failed', uploadId: payload.uploadId });
  });

  return {
    status: job.status,
    start: (choice: ChannelImageChoice) => upload.mutate(choice),
    reset: () => {
      upload.reset();
      setJob(IDLE);
    },
  };
}
