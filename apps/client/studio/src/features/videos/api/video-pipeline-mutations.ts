import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { VideoEditList } from '@vp/domain';
import { videoKeys } from '@vp/queries';
import axios from 'axios';
import { libraryKeys } from './library-queries';

const refreshVideo = (client: QueryClient, videoId: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: videoKeys.detail(videoId) }),
    client.invalidateQueries({ queryKey: libraryKeys.all }),
  ]);

export interface ReplaceFileInput {
  file: File;
  onProgress: (share: number) => void;
}

/** A new generation's presigned PUT, the file into it, then the render that swaps it in. */
export function replaceFileMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: async ({ file, onProgress }: ReplaceFileInput) => {
      const upload = await api.videoPipeline.startVideoReplacement({
        params: { id: videoId },
        body: { filename: file.name, sizeBytes: file.size, contentType: file.type },
      });
      await axios.put(upload.uploadUrl, file, {
        headers: upload.headers,
        onUploadProgress: ({ loaded, total = file.size }) => onProgress(loaded / total),
      });
      return api.videoPipeline.completeVideoReplacement({
        params: { id: videoId },
        body: { generation: upload.generation },
      });
    },
    onSettled: (_data, _error, _input, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function saveEditsMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (edits: VideoEditList) =>
      api.videoPipeline.saveVideoEdits({ params: { id: videoId }, body: edits }),
    onSettled: (_data, _error, _edits, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function revertEditsMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (version: number) =>
      api.videoPipeline.revertVideoEdits({ params: { id: videoId }, body: { version } }),
    onSettled: (_data, _error, _version, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

/** A suggestion becomes an ordinary clip through the clips endpoint, under its rules and storage. */
export function createClipMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { startMs: number; endMs: number; title: string }) =>
      api.clips.createClip({ params: { id: videoId }, body }),
  });
}
