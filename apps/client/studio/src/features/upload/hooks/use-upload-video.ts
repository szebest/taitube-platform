import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys } from '@vp/queries';
import { fromPromise, ignore } from '@vp/result';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { type UploadProgressHandler, type UploadRequest, uploadVideo } from '../api/upload-video';

interface InFlightUpload {
  controller: AbortController;
  uploadId?: string;
}

function uploadVideoMutationOptions(
  api: ApiClient,
  onProgress: UploadProgressHandler,
  inFlight: RefObject<InFlightUpload | null>
) {
  return mutationOptions({
    mutationFn: async (request: UploadRequest) => {
      const upload: InFlightUpload = { controller: new AbortController() };
      inFlight.current = upload;
      onProgress(0);

      try {
        return await uploadVideo(api, request, onProgress, {
          signal: upload.controller.signal,
          onStarted: (uploadId) => {
            upload.uploadId = uploadId;
          },
        });
      } finally {
        if (inFlight.current === upload) inFlight.current = null;
      }
    },
    onSettled: (_data, _error, _request, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoKeys.mine() }),
  });
}

export function useUploadVideo() {
  const [progress, setProgress] = useState(0);
  const inFlight = useRef<InFlightUpload | null>(null);
  const api = useApi();
  const upload = useMutation(uploadVideoMutationOptions(api, setProgress, inFlight));

  const cancel = () => inFlight.current?.controller.abort();

  useEffect(() => {
    const abortOnPageHide = (event: PageTransitionEvent) => {
      const uploadId = inFlight.current?.uploadId;
      if (event.persisted || !uploadId) return;

      ignore(
        fromPromise(
          () => api.uploads.abortUpload({ params: { uploadId }, keepalive: true }),
          (cause) => cause
        ),
        'a closing page has nowhere to report a failed abort'
      );
    };

    window.addEventListener('pagehide', abortOnPageHide);
    return () => window.removeEventListener('pagehide', abortOnPageHide);
  }, [api]);

  useEffect(() => () => inFlight.current?.controller.abort(), []);

  return { ...upload, progress, cancel };
}
