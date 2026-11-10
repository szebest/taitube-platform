import { screen } from '@testing-library/react';
import { getChannel, getOwnRestriction, listMyCommentRemovals } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, channel, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const REMOVAL = {
  id: '0190c3a0-5e1d-7000-8000-00000000d777',
  videoId: VIDEO_ID,
  excerpt: 'Buy followers at my site',
  reason: 'spam',
  note: 'Selling things',
  createdAt: '2026-11-09T09:00:00.000Z',
} as const;

const removals = (items: (typeof REMOVAL)[]) =>
  mockEndpoint(listMyCommentRemovals, () => HttpResponse.json({ items, nextCursor: null }));

async function renderModeration(url: string, handlers: HttpHandler[]) {
  return renderRoute(getRouter, url, { handlers: [signInBrowser(), ...handlers, ...loaderApi()] });
}

describe('apps/client/web: /feed/you/moderation', () => {
  it('lists the removed comments with the reason, the moderator note and a link to the video', async () => {
    await renderModeration('/feed/you/moderation', [removals([REMOVAL])]);

    expect(await screen.findByText('Buy followers at my site')).toBeInTheDocument();
    expect(screen.getByText('Reason: Spam')).toBeInTheDocument();
    expect(screen.getByText('Note: Selling things')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the video' })).toHaveAttribute(
      'href',
      `/watch/${VIDEO_ID}`
    );
  });

  it('says so when no comment was removed', async () => {
    await renderModeration('/feed/you/moderation', [removals([])]);

    expect(
      await screen.findByText(
        'A moderator has not removed any of your comments in the last 30 days'
      )
    ).toBeInTheDocument();
  });

  it.each([
    {
      name: 'a ban with its reason and end',
      ban: { reason: 'Spam', expiresAt: '2026-11-17T12:00:00.000Z' },
      lines: ['Reason: Spam', /This lasts until Nov 17, 2026/],
    },
    {
      name: 'a ban until it is lifted',
      ban: { reason: null, expiresAt: null },
      lines: ['This lasts until a moderator lifts it.'],
    },
  ])('shows $name for the channel the notification named', async ({ ban, lines }) => {
    await renderModeration(`/feed/you/moderation?channel=${CHANNEL_ID}`, [
      removals([]),
      mockEndpoint(getOwnRestriction, () => HttpResponse.json(ban)),
      mockEndpoint(getChannel, () => HttpResponse.json(channel({ displayName: 'The Creator' }))),
    ]);

    expect(await screen.findByText('You cannot comment on The Creator')).toBeInTheDocument();
    for (const line of lines) expect(screen.getByText(line)).toBeInTheDocument();
  });

  it('shows no ban for a channel where there is none, or only a shadow ban, which is never told', async () => {
    await renderModeration(`/feed/you/moderation?channel=${CHANNEL_ID}`, [
      removals([REMOVAL]),
      mockEndpoint(getOwnRestriction, () => problemReply(ErrorCodes.RESTRICTION_NOT_FOUND)),
      mockEndpoint(getChannel, () => HttpResponse.json(channel())),
    ]);

    await screen.findByText('Buy followers at my site');

    expect(screen.queryByText(/You cannot comment on/)).not.toBeInTheDocument();
  });
});
