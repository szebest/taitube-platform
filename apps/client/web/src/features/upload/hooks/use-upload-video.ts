import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys } from '@vp/queries';
import { useState } from 'react';

import { feedKeys } from '#app/features/feed/api/feed-queries';

import { type UploadProgressHandler, type UploadRequest, uploadVideo } from '../api/upload-video';

function uploadVideoMutationOptions(api: ApiClient, onProgress: UploadProgressHandler) {
  return mutationOptions({
    mutationFn: (request: UploadRequest) => {
      onProgress(0);
      return uploadVideo(api, request, onProgress);
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
  const api = useApi();
  const upload = useMutation(uploadVideoMutationOptions(api, setProgress));
  return { ...upload, progress };
}
