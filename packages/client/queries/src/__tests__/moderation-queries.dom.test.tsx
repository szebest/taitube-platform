import {
  bulkModerateComments,
  type CommentSettingsView,
  getCommentSettings,
  getOwnRestriction,
  liftRestriction,
  listMyCommentRemovals,
  moderateComment,
  restrictUser,
  updateCommentSettings,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  api,
  apiServer,
  CHANNEL_ID,
  COMMENT_ID,
  COMMENT_AUTHOR_ID,
  comment,
  mockEndpoint,
  problemReply,
} from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { creatorCommentKeys } from '../comment-queries';
import { createQueryClient } from '../create-query-client';
import {
  commentSettingsQueryOptions,
  moderationKeys,
  myCommentRemovalsQueryOptions,
  ownRestrictionQueryOptions,
  useBulkModerate,
  useLiftRestriction,
  useModerateComment,
  useRestrictUser,
  useUpdateCommentSettings,
} from '../moderation-queries';

const VIDEO_COMMENTS = ['comments', 'video', 'v1', 'top'];
const INBOX = [...creatorCommentKeys.all, 'all'];

const SETTINGS: CommentSettingsView = {
  reviewMode: 'links',
  blockedWords: ['spoiler'],
  linkAllowlist: [],
  slowModeSeconds: null,
  subscribersOnly: false,
  minAccountAgeDays: 0,
  disclosure: {
    hide: 'silent',
    remove: 'visible',
    manual_hold: 'visible',
    'auto.blocked_words': 'silent',
    'auto.links': 'visible',
    'auto.review_all': 'visible',
  },
};

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

const RESTRICTION = {
  userId: COMMENT_AUTHOR_ID,
  kind: 'ban',
  reason: null,
  expiresAt: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  user: null,
} as const;

const REFRESHING = [
  {
    mutation: 'moderate',
    hook: useModerateComment,
    variables: { commentId: COMMENT_ID, action: { action: 'hide', reason: 'spam' } },
    answer: () =>
      mockEndpoint(moderateComment, ({ request, params }) => {
        asked.push(`${request.method} ${params.id}`);
        return HttpResponse.json({ state: 'hidden', comment: comment() });
      }),
    request: `POST ${COMMENT_ID}`,
  },
  {
    mutation: 'restrict',
    hook: useRestrictUser,
    variables: {
      channelId: CHANNEL_ID,
      userId: COMMENT_AUTHOR_ID,
      action: { action: 'shadow_ban' },
    },
    answer: () =>
      mockEndpoint(restrictUser, ({ request, params }) => {
        asked.push(`${request.method} ${params.userId} ${request.headers.get('x-channel-id')}`);
        return HttpResponse.json(RESTRICTION);
      }),
    request: `PUT ${COMMENT_AUTHOR_ID} ${CHANNEL_ID}`,
  },
  {
    mutation: 'lift',
    hook: useLiftRestriction,
    variables: { channelId: CHANNEL_ID, userId: COMMENT_AUTHOR_ID },
    answer: () =>
      mockEndpoint(liftRestriction, ({ request, params }) => {
        asked.push(`${request.method} ${params.userId} ${request.headers.get('x-channel-id')}`);
        return new HttpResponse(null, { status: 204 });
      }),
    request: `DELETE ${COMMENT_AUTHOR_ID} ${CHANNEL_ID}`,
  },
  {
    mutation: 'bulk',
    hook: useBulkModerate,
    variables: { ids: [COMMENT_ID], action: { action: 'approve' } },
    answer: () =>
      mockEndpoint(bulkModerateComments, ({ request }) => {
        asked.push(request.method);
        return HttpResponse.json({ results: [{ id: COMMENT_ID, ok: true }] });
      }),
    request: 'POST',
  },
] as const;

let asked: string[] = [];

describe('@vp/queries: moderation queries', () => {
  beforeEach(() => {
    asked = [];
  });

  it.each(REFRESHING)(
    '$mutation sends one request and refreshes the watch page and inbox lists',
    async ({ hook, variables, answer, request }) => {
      apiServer.use(answer());
      const client = createQueryClient();
      for (const key of [VIDEO_COMMENTS, INBOX]) {
        client.setQueryData(key, { pages: [], pageParams: [] });
      }

      await runMutation(client, hook as never, variables as never, WithApi);

      expect(asked).toEqual([request]);
      expect(
        [VIDEO_COMMENTS, INBOX].map((key) => client.getQueryState(key)?.isInvalidated)
      ).toEqual([true, true]);
    }
  );

  it('keeps the saved settings in the cache the settings query reads', async () => {
    apiServer.use(mockEndpoint(updateCommentSettings, () => HttpResponse.json(SETTINGS)));
    const client = createQueryClient();

    await runMutation(client, useUpdateCommentSettings, SETTINGS, WithApi);

    expect(client.getQueryData(moderationKeys.settings())).toEqual(SETTINGS);
  });

  it.each([
    { channelId: undefined, header: null },
    { channelId: CHANNEL_ID, header: CHANNEL_ID },
  ])('reads the settings the API holds for channel $channelId', async ({ channelId, header }) => {
    const sent: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(getCommentSettings, ({ request }) => {
        sent.push(request.headers.get('x-channel-id'));
        return HttpResponse.json(SETTINGS);
      })
    );

    expect(
      await createQueryClient().fetchQuery(commentSettingsQueryOptions(api, channelId))
    ).toEqual(SETTINGS);
    expect(sent).toEqual([header]);
  });

  it('reads the first page of the removals', async () => {
    apiServer.use(
      mockEndpoint(listMyCommentRemovals, () => HttpResponse.json({ items: [], nextCursor: null }))
    );

    const { pages } = await createQueryClient().fetchInfiniteQuery(
      myCommentRemovalsQueryOptions(api)
    );

    expect(pages).toEqual([{ items: [], nextCursor: null }]);
  });

  it.each([
    {
      case: 'a ban',
      ban: { reason: 'Spam', expiresAt: null },
      value: { reason: 'Spam', expiresAt: null },
    },
    { case: 'no ban, or a shadow ban', ban: null, value: null },
  ])('reads $case on the channel as the composer needs it', async ({ ban, value }) => {
    apiServer.use(
      mockEndpoint(getOwnRestriction, () =>
        ban ? HttpResponse.json(ban) : problemReply(ErrorCodes.RESTRICTION_NOT_FOUND)
      )
    );

    expect(
      await createQueryClient().fetchQuery(ownRestrictionQueryOptions(api, CHANNEL_ID))
    ).toEqual(value);
  });

  it('lets any other failure through', async () => {
    apiServer.use(mockEndpoint(getOwnRestriction, () => problemReply(ErrorCodes.INTERNAL)));

    await expect(
      createQueryClient().fetchQuery(ownRestrictionQueryOptions(api, CHANNEL_ID))
    ).rejects.toThrow();
  });
});
