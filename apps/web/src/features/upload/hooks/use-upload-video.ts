import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { feedKeys } from '#app/features/feed/api/feed-queries';
import { videoKeys } from '#app/features/videos/api/video-queries';

import { type UploadProgressHandler, type UploadRequest, uploadVideo } from '../api/upload-video';

function uploadVideoMutationOptions(onProgress: UploadProgressHandler) {
  return mutationOptions({
    mutationFn: (request: UploadRequest) => {
      onProgress(0);
      return uploadVideo(request, onProgress);
    },
    onSettled: (_data, _error, _request, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
        client.invalidateQueries({ queryKey: feedKeys.all }),
      ]),
  });
}

export function useUploadVideo() {
  const [progress, setProgress] = useState(0);
  const upload = useMutation(uploadVideoMutationOptions(setProgress));
  return { ...upload, progress };
}
