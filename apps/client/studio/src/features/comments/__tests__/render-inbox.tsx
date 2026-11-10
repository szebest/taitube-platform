import { screen } from '@testing-library/react';
import {
  bulkModerateComments,
  type CommentSettingsView,
  createComment,
  getCommentSettings,
  heartComment,
  listCreatorComments,
  listSavedReplies,
  type SavedReplyView,
  pinComment,
  trustCommenter,
  unheartComment,
  unpinComment,
} from '@vp/api-contracts';
import { DEFAULT_DISCLOSURE } from '@vp/domain';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { comment, type EndpointResolver, mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import type { InboxComment } from '#app/features/comments/api/inbox-queries';
import { getRouter } from '#app/router';

/** What the API was asked: each list request, and every write in the order it arrived. */
interface InboxRequests {
  lists: { filter: string | null; cursor: string | null }[];
  writes: string[];
  replies: { videoId: string; body: unknown }[];
  bulks: { ids: string[]; action: unknown }[];
  savedRepliesAsked: number;
}

/**
 * `url` in the studio over an inbox of keyset `pages`, every write recorded and answered. The pages
 * are the API's live state: a spec that changes them sees the change on the next request.
 */
export async function renderInbox(
  url = '/comments',
  pages: InboxComment[][] = [[]],
  refused: Record<string, ErrorCode> = {},
  savedReplies: SavedReplyView[] = [],
  settings: Partial<CommentSettingsView> | 'refused' = {}
) {
  const requests: InboxRequests = {
    lists: [],
    writes: [],
    replies: [],
    bulks: [],
    savedRepliesAsked: 0,
  };
  const recordWrite =
    (name: string): EndpointResolver<typeof heartComment> =>
    ({ params }) => {
      requests.writes.push(`${name} ${String(params.id)}`);
      return HttpResponse.json(comment({ id: String(params.id) }));
    };
  const rendered = await renderRoute(getRouter, url, {
    handlers: [
      signInBrowser(),
      mockEndpoint(listCreatorComments, ({ request }) => {
        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        const index = cursor ? Number(cursor) : 0;
        requests.lists.push({ filter: searchParams.get('filter'), cursor });
        return HttpResponse.json({
          items: pages[index] ?? [],
          nextCursor: index + 1 < pages.length ? String(index + 1) : null,
        });
      }),
      mockEndpoint(getCommentSettings, () =>
        settings === 'refused'
          ? problemReply(ErrorCodes.FORBIDDEN)
          : HttpResponse.json({
              reviewMode: 'none',
              blockedWords: [],
              linkAllowlist: [],
              slowModeSeconds: null,
              subscribersOnly: false,
              minAccountAgeDays: 0,
              disclosure: DEFAULT_DISCLOSURE,
              ...settings,
            })
      ),
      mockEndpoint(createComment, async ({ request, params }) => {
        requests.replies.push({ videoId: String(params.id), body: await request.json() });
        return HttpResponse.json(comment(), { status: 201 });
      }),
      mockEndpoint(bulkModerateComments, async ({ request }) => {
        const body = (await request.json()) as { ids: string[]; action: unknown };
        requests.bulks.push(body);
        return HttpResponse.json({
          results: body.ids.map((id) =>
            refused[id] ? { id, ok: false, code: refused[id] } : { id, ok: true }
          ),
        });
      }),
      mockEndpoint(listSavedReplies, () => {
        requests.savedRepliesAsked += 1;
        return HttpResponse.json({ items: savedReplies });
      }),
      mockEndpoint(trustCommenter, ({ params }) => {
        requests.writes.push(`trust ${String(params.userId)}`);
        return new HttpResponse(null, { status: 204 });
      }),
      mockEndpoint(heartComment, recordWrite('heart')),
      mockEndpoint(unheartComment, recordWrite('unheart')),
      mockEndpoint(pinComment, recordWrite('pin')),
      mockEndpoint(unpinComment, recordWrite('unpin')),
    ],
  });
  await screen.findByRole('heading', { level: 1, name: 'Comments' });
  return { ...rendered, requests, pages };
}
