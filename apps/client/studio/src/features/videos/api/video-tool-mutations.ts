import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ExperimentView, Video } from '@vp/api-contracts';
import type { ExperimentKind, ShareLinkExpiry, ThumbnailSelection } from '@vp/domain';
import { shareLinksQueryOptions, videoKeys, videoQueryOptions, videoToolKeys } from '@vp/queries';
import { libraryKeys } from './library-queries';

const refreshVideo = (client: QueryClient, videoId: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: videoKeys.detail(videoId) }),
    client.invalidateQueries({ queryKey: libraryKeys.all }),
  ]);

const storeVideo = (client: QueryClient, api: ApiClient, videoId: string, video: Video) =>
  client.setQueryData(videoQueryOptions(api, videoId).queryKey, video);

export function replaceChaptersMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { chapters: { startMs: number; title: string }[]; version: number }) =>
      api.videoTools.replaceVideoChapters({ params: { id: videoId }, body }),
    onSuccess: (updated, _body, _snapshot, { client }) => storeVideo(client, api, videoId, updated),
    onSettled: (_data, _error, _body, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function suggestChaptersMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: () => api.videoTools.getChapterSuggestions({ params: { id: videoId } }),
  });
}

export function restoreRevisionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (target: { revisionId: string; version: number }) =>
      api.videoTools.restoreVideoRevision({
        params: { id: videoId, revisionId: target.revisionId },
        body: { version: target.version },
      }),
    onSuccess: (updated, _target, _snapshot, { client }) =>
      storeVideo(client, api, videoId, updated),
    onSettled: (_data, _error, _target, _snapshot, { client }) =>
      Promise.all([
        refreshVideo(client, videoId),
        client.invalidateQueries({ queryKey: videoToolKeys.revisions(videoId) }),
      ]),
  });
}

export function addCorrectionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { startMs: number; endMs: number; text: string }) =>
      api.videoTools.createVideoCorrection({ params: { id: videoId }, body }),
    onSettled: (_data, _error, _body, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoToolKeys.corrections(videoId) }),
  });
}

export function updateCorrectionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: ({
      correctionId,
      changes,
    }: {
      correctionId: string;
      changes: { startMs?: number; endMs?: number; text?: string };
    }) =>
      api.videoTools.updateVideoCorrection({
        params: { id: videoId, correctionId },
        body: changes,
      }),
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoToolKeys.corrections(videoId) }),
  });
}

export function removeCorrectionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (correctionId: string) =>
      api.videoTools.deleteVideoCorrection({ params: { id: videoId, correctionId } }),
    onSettled: (_data, _error, _id, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoToolKeys.corrections(videoId) }),
  });
}

const refreshShareLinks = (client: QueryClient, videoId: string) =>
  client.invalidateQueries({ queryKey: videoToolKeys.shareLinks(videoId) });

const refreshExperiments = (client: QueryClient, videoId: string) =>
  client.invalidateQueries({ queryKey: videoToolKeys.experiments(videoId) });

export function createShareLinkMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { label?: string; expiresIn: ShareLinkExpiry }) =>
      api.videoAccess.createVideoShareLink({ params: { id: videoId }, body }),
    onSettled: (_data, _error, _body, _snapshot, { client }) => refreshShareLinks(client, videoId),
  });
}

/** The link reads as revoked in the table at once, and goes back to what it was if the API refuses. */
export function revokeShareLinkMutationOptions(api: ApiClient, videoId: string) {
  const { queryKey } = shareLinksQueryOptions(api, videoId);

  return mutationOptions({
    mutationFn: (linkId: string) =>
      api.videoAccess.revokeVideoShareLink({ params: { id: videoId, linkId } }),
    onMutate: async (linkId, { client }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) {
        const revokedAt = new Date().toISOString();
        client.setQueryData(queryKey, {
          items: previous.items.map((link) =>
            link.id === linkId ? { ...link, state: 'revoked' as const, revokedAt } : link
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _linkId, snapshot, { client }) => {
      if (snapshot?.previous) client.setQueryData(queryKey, snapshot.previous);
    },
    onSettled: (_data, _error, _linkId, _snapshot, { client }) =>
      refreshShareLinks(client, videoId),
  });
}

const markProtected = (
  client: QueryClient,
  api: ApiClient,
  videoId: string,
  passwordProtected: boolean
) =>
  client.setQueryData(videoQueryOptions(api, videoId).queryKey, (video) =>
    video ? { ...video, passwordProtected } : video
  );

export function setPasswordMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (password: string) =>
      api.videoAccess.setVideoPassword({ params: { id: videoId }, body: { password } }),
    onSuccess: (_result, _password, _snapshot, { client }) =>
      markProtected(client, api, videoId, true),
    onSettled: (_data, _error, _password, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function clearPasswordMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: () => api.videoAccess.clearVideoPassword({ params: { id: videoId } }),
    onSuccess: (_result, _variables, _snapshot, { client }) =>
      markProtected(client, api, videoId, false),
    onSettled: (_data, _error, _variables, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function startExperimentMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: {
      kind: ExperimentKind;
      variants: { title?: string; thumbnail?: ThumbnailSelection }[];
    }) => api.videoExperiments.createVideoExperiment({ params: { id: videoId }, body }),
    onSettled: (_data, _error, _body, _snapshot, { client }) => refreshExperiments(client, videoId),
  });
}

export function stopExperimentMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (experimentId: string) =>
      api.videoExperiments.stopVideoExperiment({ params: { id: videoId, experimentId } }),
    onSettled: (_data, _error, _id, _snapshot, { client }) => refreshExperiments(client, videoId),
  });
}

/** Writes the chosen variant through the normal edit under `version`, so a stale one is a conflict. */
export function applyExperimentMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: ({
      experimentId,
      variantId,
      version,
    }: {
      experimentId: string;
      variantId: ExperimentView['variants'][number]['id'];
      version: number;
    }) =>
      api.videoExperiments.applyVideoExperiment({
        params: { id: videoId, experimentId },
        body: { variantId, version },
      }),
    onSuccess: (updated, _choice, _snapshot, { client }) =>
      storeVideo(client, api, videoId, updated),
    onSettled: (_data, _error, _choice, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}
