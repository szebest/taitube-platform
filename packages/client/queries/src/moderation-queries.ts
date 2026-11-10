import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  useMutation,
} from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type {
  BulkActionBody,
  CommentActionBody,
  CommentSettingsView,
  RestrictionActionBody,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { fromPromise } from '@vp/result';
import { useApi } from './api-provider';
import { commentListKeys, creatorCommentKeys } from './comment-queries';
import { failureCode } from './failure-code';
import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';

export const moderationKeys = {
  all: ['moderation'] as const,
  removals: () => [...moderationKeys.all, 'removals'] as const,
  restrictions: () => [...moderationKeys.all, 'restrictions'] as const,
  trusted: () => [...moderationKeys.all, 'trusted'] as const,
  savedReplies: () => [...moderationKeys.all, 'saved-replies'] as const,
  restriction: (channelId: string) => [...moderationKeys.all, 'restriction', channelId] as const,
  settings: (channelId?: string) => [...moderationKeys.all, 'settings', channelId] as const,
};

const CHANNEL_HEADER = 'x-channel-id';

const channelHeaders = (channelId: string) => ({ [CHANNEL_HEADER]: channelId });

/** The caller's own visibly removed comments, newest first, keyset-paged. */
export function myCommentRemovalsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: moderationKeys.removals(),
    queryFn: ({ pageParam }) =>
      api.commentRemovals.listMyCommentRemovals({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The caller's own visible ban on a channel, or `null`: a shadow ban is never told, so it reads as none. */
export function ownRestrictionQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: moderationKeys.restriction(channelId),
    queryFn: async () => {
      const own = await fromPromise(
        api.channelRestrictions.getOwnRestriction({ params: { id: channelId } }),
        (cause) => cause
      );
      if (own.ok) {
        return own.value;
      }
      if (failureCode(own.error) === ErrorCodes.RESTRICTION_NOT_FOUND) {
        return null;
      }
      throw own.error;
    },
    retry: false,
  });
}

/** The comment settings of the acting channel, or of `channelId` for an app with no acting channel; the owner and managers read them. */
export function commentSettingsQueryOptions(api: ApiClient, channelId?: string) {
  return queryOptions({
    queryKey: moderationKeys.settings(channelId),
    queryFn: () =>
      api.commentSettings.getCommentSettings({
        headers: channelId ? channelHeaders(channelId) : undefined,
      }),
  });
}

interface ModerateComment {
  commentId: string;
  action: CommentActionBody;
}

interface RestrictUser {
  channelId: string;
  userId: string;
  action: RestrictionActionBody;
}

interface LiftRestriction {
  channelId: string;
  userId: string;
}

interface BulkModerate {
  ids: string[];
  action: BulkActionBody;
}

function moderateCommentMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ commentId, action }: ModerateComment) =>
      api.commentModeration.moderateComment({ params: { id: commentId }, body: action }),
    onSuccess: (_result, _moderation, _snapshot, { client }) =>
      Promise.all(commentListKeys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

function restrictUserMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ channelId, userId, action }: RestrictUser) =>
      api.channelRestrictions.restrictUser({
        params: { userId },
        body: action,
        headers: channelHeaders(channelId),
      }),
    onSuccess: (_restriction, _variables, _snapshot, { client }) =>
      Promise.all(
        [...commentListKeys, moderationKeys.restrictions()].map((queryKey) =>
          client.invalidateQueries({ queryKey })
        )
      ),
  });
}

function liftRestrictionMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ channelId, userId }: LiftRestriction) =>
      api.channelRestrictions.liftRestriction({
        params: { userId },
        headers: channelHeaders(channelId),
      }),
    onSuccess: (_nothing, _variables, _snapshot, { client }) =>
      Promise.all(
        [...commentListKeys, moderationKeys.restrictions()].map((queryKey) =>
          client.invalidateQueries({ queryKey })
        )
      ),
  });
}

interface HeldPages {
  pages: { items: { id: string }[] }[];
}

const without = (held: HeldPages, ids: readonly string[]): HeldPages => ({
  ...held,
  pages: held.pages.map((page) => ({
    ...page,
    items: page.items.filter(({ id }) => !ids.includes(id)),
  })),
});

function bulkModerateMutationOptions(api: ApiClient) {
  const heldKey = creatorCommentKeys.list('held');

  return mutationOptions({
    mutationFn: ({ ids, action }: BulkModerate) =>
      api.creatorComments.bulkModerateComments({ body: { ids, action } }),
    onMutate: async ({ ids }, { client }) => {
      await client.cancelQueries({ queryKey: heldKey });
      const held = client.getQueryData<HeldPages>(heldKey);
      if (held) client.setQueryData(heldKey, without(held, ids));
      return held;
    },
    onError: (_error, _variables, held, { client }) => {
      if (held) client.setQueryData(heldKey, held);
    },
    onSettled: (_result, _error, _variables, _snapshot, { client }) =>
      Promise.all(commentListKeys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

function updateCommentSettingsMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: (settings: CommentSettingsView) =>
      api.commentSettings.updateCommentSettings({ body: settings }),
    onSuccess: (saved, _settings, _snapshot, { client }) =>
      client.setQueryData(moderationKeys.settings(), saved),
  });
}

/** Hold, approve, hide, unhide or remove one comment; the lists that show it reload. */
export function useModerateComment() {
  const api = useApi();
  return useMutation(moderateCommentMutationOptions(api));
}

/** Shadow bans or bans a user on a channel the caller moderates, which may not be their own. */
export function useRestrictUser() {
  const api = useApi();
  return useMutation(restrictUserMutationOptions(api));
}

export function useLiftRestriction() {
  const api = useApi();
  return useMutation(liftRestrictionMutationOptions(api));
}

/**
 * One action over up to 100 comments; each id answers on its own, so the lists reload even when some
 * were refused. The held queue drops the comments at once and gets them back when the call fails.
 */
export function useBulkModerate() {
  const api = useApi();
  return useMutation(bulkModerateMutationOptions(api));
}

export function useUpdateCommentSettings() {
  const api = useApi();
  return useMutation(updateCommentSettingsMutationOptions(api));
}
