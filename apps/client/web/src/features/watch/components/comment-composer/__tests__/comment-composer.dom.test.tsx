import { screen, within } from '@testing-library/react';
import {
  createComment,
  getOwnRestriction,
  listVideoComments,
  PROBLEM_CONTENT_TYPE,
  problemDetails,
  subscribeToChannel,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, comment, mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { AUTHOR_ID, membershipOn, OTHER_ID, viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderDiscussion } from '#app/features/watch/__tests__/render-discussion';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const VIEWER = viewerAccount(AUTHOR_ID);

const thread = mockEndpoint(listVideoComments, () =>
  HttpResponse.json({ items: [comment()], nextCursor: null, total: 1 })
);

const refusing = (code: string, errors: unknown[] = [], headers: Record<string, string> = {}) =>
  mockEndpoint(createComment, () =>
    HttpResponse.json(
      problemDetails({
        code: code as never,
        status: 403,
        title: code,
        detail: code,
        instance: 'msw',
        errors,
      }),
      { status: 403, headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...headers } }
    )
  );

async function writeComment(handlers: Parameters<typeof renderDiscussion>[0]['handlers']) {
  const rendered = await renderDiscussion({ viewer: VIEWER, handlers: [thread, ...handlers] });
  await rendered.user.type(
    await screen.findByRole('textbox', { name: 'Add a comment' }),
    'Watched it twice.'
  );
  await rendered.user.click(screen.getByRole('button', { name: 'Comment' }));

  return rendered;
}

describe('apps/client/web: CommentComposer', () => {
  it.each([
    { viewer: 'a viewer', account: VIEWER, memberships: [], field: false },
    { viewer: 'the video owner', account: viewerAccount(OWNER_ID), memberships: [], field: true },
    {
      viewer: 'a channel moderator',
      account: viewerAccount(OTHER_ID),
      memberships: [membershipOn('moderator')],
      field: true,
    },
  ])(
    'shows $viewer the field when comments are off: $field',
    async ({ account, memberships, field }) => {
      await renderDiscussion({
        viewer: account,
        memberships,
        handlers: [thread],
        video: { commentsEnabled: false },
      });

      if (field) {
        await vi.waitFor(() =>
          expect(screen.getByRole('textbox', { name: 'Add a comment' })).toBeVisible()
        );
        return;
      }
      expect(await screen.findByText('Comments are turned off for this video')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
    }
  );

  it.each([
    {
      name: 'a ban with a reason and an end',
      ban: { reason: 'Spam', expiresAt: '2026-11-17T12:00:00.000Z' },
      lines: [
        'You cannot comment on this channel',
        'Reason: Spam',
        /This lasts until Nov 17, 2026/,
      ],
    },
    {
      name: 'a ban until it is lifted',
      ban: { reason: null, expiresAt: null },
      lines: ['You cannot comment on this channel', 'This lasts until a moderator lifts it.'],
    },
  ])('puts $name in place of the field', async ({ ban, lines }) => {
    await renderDiscussion({
      viewer: VIEWER,
      handlers: [thread, mockEndpoint(getOwnRestriction, () => HttpResponse.json(ban))],
    });

    for (const line of lines) expect(await screen.findByText(line)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('shows the normal field to a viewer with no visible ban, which is also what a shadow ban answers', async () => {
    await renderDiscussion({ viewer: VIEWER, handlers: [thread] });

    expect(await screen.findByRole('textbox', { name: 'Add a comment' })).toBeVisible();
  });

  it('puts a ban the API refuses the post with in place of the field', async () => {
    await writeComment([
      refusing(ErrorCodes.COMMENTS_BANNED, [{ reason: 'Spam', expiresAt: null }]),
    ]);

    expect(await screen.findByText('Reason: Spam')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('offers a subscriber-only refusal the Subscribe action, and gives the field back once subscribed', async () => {
    const subscribed: string[] = [];
    const subscribe = mockEndpoint(subscribeToChannel, ({ params }) => {
      subscribed.push(String(params.id));
      return HttpResponse.json({ channelId: CHANNEL_ID, subscribed: true, subscriberCount: 1 });
    });
    const { user } = await writeComment([
      refusing(ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY),
      subscribe,
    ]);

    const title = await screen.findByText('Only subscribers can comment on this channel');
    const notice = title.closest<HTMLElement>('[data-slot="callout"]');
    if (!notice) {
      throw new Error('the refusal is not in a callout');
    }

    await user.click(within(notice).getByRole('button', { name: 'Subscribe' }));

    expect(await screen.findByRole('textbox', { name: 'Add a comment' })).toBeVisible();
    expect(subscribed).toEqual([CHANNEL_ID]);
  });

  it('names the day a too-new account can comment', async () => {
    await writeComment([
      refusing(ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW, [{ opensAt: '2026-11-12' }]),
    ]);

    expect(
      await screen.findByText('Your account can comment from Nov 12, 2026')
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('keeps the text and counts slow mode down on the button until it can post again', async () => {
    await writeComment([
      refusing(ErrorCodes.COMMENTS_SLOW_MODE, [{ retryAfter: 2 }], { 'retry-after': '2' }),
    ]);

    const waiting = await screen.findByRole('button', { name: /^Wait \d s$/ });

    expect(waiting).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Add a comment' })).toHaveValue('Watched it twice.');
    expect(screen.queryByText('Not posted')).not.toBeInTheDocument();

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled(), {
      timeout: 4000,
    });
  });

  it('treats any other failure as a comment that did not post', async () => {
    await writeComment([mockEndpoint(createComment, () => problemReply(ErrorCodes.INTERNAL))]);

    expect(await screen.findByText('Not posted')).toBeInTheDocument();
  });
});
