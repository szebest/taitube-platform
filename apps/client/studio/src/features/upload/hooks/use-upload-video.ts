import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys } from '@vp/queries';
import { useState } from 'react';

import { type UploadProgressHandler, type UploadRequest, uploadVideo } from '../api/upload-video';

function uploadVideoMutationOptions(api: ApiClient, onProgress: UploadProgressHandler) {
  return mutationOptions({
    mutationFn: (request: UploadRequest) => {
      onProgress(0);
      return uploadVideo(api, request, onProgress);
    },
    onSettled: (_data, _error, _request, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoKeys.mine() }),
  });
}

export function useUploadVideo() {
  const [progress, setProgress] = useState(0);
  const api = useApi();
  const upload = useMutation(uploadVideoMutationOptions(api, setProgress));
  return { ...upload, progress };
}
