import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys } from '@vp/queries';
import { assertNever, fromPromise, ignore, isOk } from '@vp/result';
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

interface UploadOutcome {
  onSuccess?: (completed: CompletedUpload) => void;
  onError?: (cause: unknown) => void;
}

type InFlightUpload = { controller: AbortController } & (
  | { kind: 'starting' }
  | { kind: 'uploading'; uploadId: string }
  | { kind: 'completing' }
);

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

function openUploadId(flight: InFlightUpload): string | undefined {
  switch (flight.kind) {
    case 'uploading':
      return flight.uploadId;
    case 'starting':
    case 'completing':
      return undefined;
    default:
      return assertNever(flight, 'openUploadId');
  }
}

export function useUploadVideo() {
  const inFlight = useRef(new Map<string, InFlightUpload>());
  const api = useApi();
  const upload = useMutation(uploadVideoMutationOptions(api));

  const send = async (
    id: string,
    request: UploadRequest,
    { onSuccess, onError }: UploadOutcome
  ) => {
    const flights = inFlight.current;
    const controller = new AbortController();
    flights.set(id, { kind: 'starting', controller });

    const outcome = await fromPromise(
      () =>
        upload.mutateAsync({
          id,
          request,
          session: {
            signal: controller.signal,
            onStarted: (uploadId) => flights.set(id, { kind: 'uploading', controller, uploadId }),
            onCompleting: () => flights.set(id, { kind: 'completing', controller }),
          },
        }),
      (cause) => cause
    );
    flights.delete(id);

    if (isOk(outcome)) onSuccess?.(outcome.value);
    else onError?.(outcome.error);
  };

  const start = (id: string, request: UploadRequest, outcome: UploadOutcome = {}) => {
    void send(id, request, outcome);
  };

  const cancel = (id: string) => inFlight.current.get(id)?.controller.abort();

  useEffect(() => {
    const abortOnPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;

      for (const flight of inFlight.current.values()) {
        const uploadId = openUploadId(flight);
        if (!uploadId) continue;

        ignore(
          fromPromise(
            () => api.uploads.abortUpload({ params: { uploadId }, keepalive: true }),
            (cause) => cause
          ),
          'a closing page has nowhere to report a failed abort'
        );
      }
    };

    window.addEventListener('pagehide', abortOnPageHide);
    return () => window.removeEventListener('pagehide', abortOnPageHide);
  }, [api]);

  useEffect(() => {
    const flights = inFlight.current;
    return () => {
      for (const flight of flights.values()) flight.controller.abort();
    };
  }, []);

  return { ...upload, start, cancel };
}
