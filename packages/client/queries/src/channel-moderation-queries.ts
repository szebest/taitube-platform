import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  useMutation,
} from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, createSavedReply, updateSavedReply } from '@vp/api-contracts';
import { useApi } from './api-provider';
import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';
import { moderationKeys } from './moderation-queries';

/** The shadow bans and bans on the acting channel that have not ended, newest first. */
export function restrictionsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: moderationKeys.restrictions(),
    queryFn: ({ pageParam }) =>
      api.channelRestrictions.listRestrictions({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The users the acting channel's automatic holds and limits skip, newest first. */
export function trustedCommentersQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: moderationKeys.trusted(),
    queryFn: ({ pageParam }) =>
      api.trustedCommenters.listTrustedCommenters({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The acting channel's canned replies, by position. */
export function savedRepliesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: moderationKeys.savedReplies(),
    queryFn: () => api.savedReplies.listSavedReplies(),
    select: ({ items }) => items,
  });
}

type NewSavedReply = ContractBody<typeof createSavedReply>;

type SavedReplyEdit = ContractBody<typeof updateSavedReply>;

function trustMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ userId, trusted }: { userId: string; trusted: boolean }) =>
      trusted
        ? api.trustedCommenters.trustCommenter({ params: { userId } })
        : api.trustedCommenters.untrustCommenter({ params: { userId } }),
    onSuccess: (_nothing, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: moderationKeys.trusted() }),
  });
}

function savedReplyMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: async (change: SavedReplyChange) => {
      switch (change.type) {
        case 'create':
          return api.savedReplies.createSavedReply({ body: change.reply });
        case 'update':
          return api.savedReplies.updateSavedReply({
            params: { id: change.id },
            body: change.edit,
          });
        case 'delete':
          return api.savedReplies.deleteSavedReply({ params: { id: change.id } });
      }
    },
    onSuccess: (_reply, _change, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: moderationKeys.savedReplies() }),
  });
}

type SavedReplyChange =
  | { type: 'create'; reply: NewSavedReply }
  | { type: 'update'; id: string; edit: SavedReplyEdit }
  | { type: 'delete'; id: string };

/** Trusts a commenter or stops trusting them; the trusted list reloads. */
export function useTrustCommenter() {
  const api = useApi();
  return useMutation(trustMutationOptions(api));
}

/** Creates, edits, moves or deletes one saved reply; the list reloads. */
export function useChangeSavedReply() {
  const api = useApi();
  return useMutation(savedReplyMutationOptions(api));
}
