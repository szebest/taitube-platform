import { type MutateOptions, mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys } from '@vp/queries';
import { fromPromise, ignore } from '@vp/result';
import { useEffect, useRef } from 'react';

import { uploadKeys } from '../api/upload-progress';
import {
  type CompletedUpload,
  type UploadRequest,
  type UploadSession,
  uploadVideo,
} from '../api/upload-video';

export interface UploadVariables {
  id: string;
  request: UploadRequest;
  session?: UploadSession;
}

function uploadVideoMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationKey: uploadKeys.all,
    mutationFn: ({ id, request, session }: UploadVariables, { client }) => {
      const key = uploadKeys.progress(id);
      client.setQueryData(key, { loaded: 0, total: request.file.size });

      return uploadVideo(api, request, (progress) => client.setQueryData(key, progress), session);
    },
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoKeys.mine() }),
  });
}

interface InFlightUpload {
  controller: AbortController;
  uploadId?: string;
}

export function useUploadVideo() {
  const inFlight = useRef<InFlightUpload | null>(null);
  const api = useApi();
  const upload = useMutation(uploadVideoMutationOptions(api));

  const start = (
    id: string,
    request: UploadRequest,
    options?: MutateOptions<CompletedUpload, Error, UploadVariables>
  ) => {
    const flight: InFlightUpload = { controller: new AbortController() };
    inFlight.current = flight;

    upload.mutate(
      {
        id,
        request,
        session: {
          signal: flight.controller.signal,
          onStarted: (uploadId) => {
            flight.uploadId = uploadId;
          },
          onCompleting: () => {
            flight.uploadId = undefined;
          },
        },
      },
      {
        ...options,
        onSettled: (...settled) => {
          if (inFlight.current === flight) inFlight.current = null;
          options?.onSettled?.(...settled);
        },
      }
    );
  };

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

  return { ...upload, start, cancel };
}
