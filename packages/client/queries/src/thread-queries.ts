import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  useMutation,
} from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ThreadBody } from '@vp/api-contracts';
import type { CommentSort } from '@vp/domain';
import { useApi } from './api-provider';

const GUEST_KEY = 'guest';

/** @internal */
export const threadKeys = {
  all: ['threads'] as const,
  lists: () => [...threadKeys.all, 'list'] as const,
  video: (videoId: string) => [...threadKeys.lists(), videoId] as const,
  list: (videoId: string, viewerId: string | null) =>
    [...threadKeys.video(videoId), viewerId ?? GUEST_KEY] as const,
  details: () => [...threadKeys.all, 'detail'] as const,
  detail: (threadId: string, viewerId: string | null) =>
    [...threadKeys.details(), threadId, viewerId ?? GUEST_KEY] as const,
  comments: (threadId: string, sort: CommentSort) =>
    [...threadKeys.all, 'comments', threadId, sort] as const,
};

/** The threads of a video and the markers the seek bar draws; the viewer is in the key because a held thread is listed to its author only. */
export function videoThreadsQueryOptions(api: ApiClient, videoId: string, viewerId: string | null) {
  return queryOptions({
    queryKey: threadKeys.list(videoId, viewerId),
    queryFn: () => api.threads.listVideoThreads({ params: { id: videoId } }),
  });
}

export function threadQueryOptions(api: ApiClient, threadId: string, viewerId: string | null) {
  return queryOptions({
    queryKey: threadKeys.detail(threadId, viewerId),
    queryFn: () => api.threads.getThread({ params: { id: threadId } }),
  });
}

/** The root comments under a thread, which share the video comment contract. */
export function threadCommentsQueryOptions(api: ApiClient, threadId: string, sort: CommentSort) {
  return infiniteQueryOptions({
    queryKey: threadKeys.comments(threadId, sort),
    queryFn: ({ pageParam }) =>
      api.threads.listThreadComments({
        params: { id: threadId },
        query: { sort, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

function createThreadMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (thread: ThreadBody) =>
      api.threads.createVideoThread({ params: { id: videoId }, body: thread }),
    onSuccess: (_thread, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: threadKeys.video(videoId) }),
  });
}

interface ThreadPin {
  threadId: string;
  pinned: boolean;
}

function pinThreadMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ threadId, pinned }: ThreadPin) => {
      const request = { params: { id: threadId } };
      return pinned ? api.threads.pinThread(request) : api.threads.unpinThread(request);
    },
    onSuccess: (_thread, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: threadKeys.all }),
  });
}

interface ThreadReply {
  content: string;
  parentId?: string;
}

function replyInThreadMutationOptions(api: ApiClient, threadId: string) {
  return mutationOptions({
    mutationFn: (reply: ThreadReply) =>
      api.threads.createThreadComment({ params: { id: threadId }, body: reply }),
    onSettled: (_comment, _error, _reply, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: threadKeys.all }),
  });
}

/** Starts a thread at a moment of the video; the video's threads and markers reload. */
export function useCreateThread(videoId: string) {
  const api = useApi();
  return useMutation(createThreadMutationOptions(api, videoId));
}

/** Pins a thread, which then draws a marker whatever its replies, or takes the pin off. @internal */
export function usePinThread() {
  const api = useApi();
  return useMutation(pinThreadMutationOptions(api));
}

/** A root comment in a thread, or a reply to one; the thread's count, its replies and the markers reload. */
export function useReplyInThread(threadId: string) {
  const api = useApi();
  return useMutation(replyInThreadMutationOptions(api, threadId));
}
