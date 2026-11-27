import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type { PostWriteBody } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { postKeys } from '../api/post-queries';

export interface PostEdit {
  id: string;
  version: number;
  body: PostWriteBody;
}

export interface PostPin {
  id: string;
  pin: boolean;
}

const refetchPosts = (client: QueryClient) => client.invalidateQueries({ queryKey: postKeys.all });

export function useCreatePost() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: PostWriteBody) => api.posts.createPost({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchPosts(client),
    })
  );
}

export function useUpdatePost() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, version, body }: PostEdit) =>
        api.posts.updatePost({ params: { id }, body: { ...body, version } }),
      onSettled: (_data, _error, _edit, _snapshot, { client }) => refetchPosts(client),
    })
  );
}

export interface PostRestore {
  id: string;
  revisionId: string;
  version: number;
}

export function useRestorePostRevision() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, revisionId, version }: PostRestore) =>
        api.postRevisions.restorePostRevision({
          params: { id, revisionId },
          body: { version },
        }),
      onSettled: (_data, _error, _restore, _snapshot, { client }) => refetchPosts(client),
    })
  );
}

export function useDeletePost() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.posts.deletePost({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchPosts(client),
    })
  );
}

export function usePinPost() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, pin }: PostPin) =>
        pin
          ? api.postStudio.pinPost({ params: { id } })
          : api.postStudio.unpinPost({ params: { id } }),
      onSettled: (_data, _error, _pin, _snapshot, { client }) => refetchPosts(client),
    })
  );
}
