import { screen } from '@testing-library/react';
import {
  bulkModerateComments,
  type CommentSettingsView,
  getCommentSettings,
  listCreatorComments,
} from '@vp/api-contracts';
import { DEFAULT_DISCLOSURE } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { inboxComment, mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import type { InboxComment } from '#app/features/comments/api/inbox-queries';
import { getRouter } from '#app/router';

const SETTINGS: CommentSettingsView = {
  reviewMode: 'none',
  blockedWords: [],
  linkAllowlist: [],
  slowModeSeconds: null,
  subscribersOnly: false,
  minAccountAgeDays: 0,
  disclosure: DEFAULT_DISCLOSURE,
};

export const heldComment = (overrides: Partial<InboxComment> = {}): InboxComment =>
  inboxComment({
    status: 'held',
    moderation: { state: 'held', heldReason: 'link' },
    ...overrides,
  });

interface QueueOptions {
  held: InboxComment[];
  history?: InboxComment[];
  settings?: Partial<CommentSettingsView>;
  /** The settings read is refused, as it is for a moderator. */
  settingsRefused?: boolean;
  /** Answers a bulk call itself; accepted when it returns nothing. */
  bulk?: (ids: string[]) => Response | Promise<Response> | undefined;
}

/** The review queue over `held`, every bulk call recorded and, unless `bulk` answers otherwise, accepted. */
export async function renderQueue({
  held,
  history = [],
  settings,
  settingsRefused = false,
  bulk,
}: QueueOptions) {
  const requests = {
    bulks: [] as { ids: string[]; action: Record<string, unknown> }[],
    authors: [] as string[],
  };
  const rendered = await renderRoute(getRouter, '/comments/queue', {
    handlers: [
      signInBrowser(),
      mockEndpoint(listCreatorComments, ({ request }) => {
        const { searchParams } = new URL(request.url);
        const authorId = searchParams.get('authorId');
        if (authorId) {
          requests.authors.push(authorId);
          return HttpResponse.json({ items: history, nextCursor: null });
        }
        return HttpResponse.json({ items: held, nextCursor: null });
      }),
      mockEndpoint(getCommentSettings, () =>
        settingsRefused
          ? problemReply(ErrorCodes.FORBIDDEN)
          : HttpResponse.json({ ...SETTINGS, ...settings })
      ),
      mockEndpoint(bulkModerateComments, async ({ request }) => {
        const body = (await request.json()) as (typeof requests.bulks)[number];
        requests.bulks.push(body);
        return (
          (await bulk?.(body.ids)) ??
          HttpResponse.json({ results: body.ids.map((id) => ({ id, ok: true })) })
        );
      }),
    ],
  });
  await screen.findByRole('heading', { level: 1, name: 'Review queue' });
  return { ...rendered, requests };
}
