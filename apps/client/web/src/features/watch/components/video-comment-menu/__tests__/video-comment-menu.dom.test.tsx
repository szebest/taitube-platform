import { fireEvent, screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import {
  type Account,
  type ChannelMembershipView,
  type CommentView,
  liftRestriction,
  moderateComment,
  pinComment,
  unpinComment,
} from '@vp/api-contracts';
import { mockEndpoint, OWNER_ID } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import {
  AUTHOR_ID,
  COMMENT_ID,
  comment,
  membershipOn,
  OTHER_ID,
  viewerAccount,
} from '#app/__tests__/comment-fixtures';
import { renderComment } from '#app/features/watch/__tests__/render-comment';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

interface Viewer {
  viewer: string;
  account?: Account;
  memberships?: ChannelMembershipView[];
}

const OTHER: Viewer = { viewer: 'another viewer', account: viewerAccount(OTHER_ID) };
const AUTHOR: Viewer = { viewer: 'the author', account: viewerAccount(AUTHOR_ID) };
const OWNER: Viewer = { viewer: 'the video owner', account: viewerAccount(OWNER_ID) };
const CHANNEL_MODERATOR: Viewer = {
  viewer: 'a channel moderator',
  account: viewerAccount(OTHER_ID),
  memberships: [membershipOn('moderator')],
};
const CHANNEL_ANALYST: Viewer = {
  viewer: 'a channel analyst',
  account: viewerAccount(OTHER_ID),
  memberships: [membershipOn('analytics')],
};

const MODERATION = [
  'Hold for review',
  'Hide',
  'Remove',
  'Shadow ban user',
  'Ban user',
  'Lift restriction',
];

async function openMenu({
  account,
  memberships,
  top,
  handlers,
}: Pick<Viewer, 'account' | 'memberships'> & {
  top?: Partial<CommentView>;
  handlers?: HttpHandler[];
}) {
  const rendered = await renderComment({ viewer: account, memberships, top, handlers });
  await rendered.user.click(rendered.article.getByRole('button', { name: 'More actions' }));

  return rendered;
}

/** Radix closes a submenu when jsdom's pointer leaves its trigger, so the item is clicked directly. */
async function chooseModeration(user: UserEvent, choice: string) {
  await user.click(screen.getByRole('menuitem', { name: 'Moderate' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: choice }));
}

const itemNames = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

describe('apps/client/web: VideoCommentMenu', () => {
  it.each([
    { ...OTHER, actions: ['Report'] },
    { ...AUTHOR, actions: ['Edit', 'Delete'] },
    { ...OWNER, actions: ['Pin', 'Delete', 'Report', 'Moderate'] },
    { ...CHANNEL_MODERATOR, actions: ['Pin', 'Delete', 'Report', 'Moderate'] },
    { ...CHANNEL_ANALYST, actions: ['Report'] },
  ])('gives $viewer these menu actions: $actions', async ({ account, memberships, actions }) => {
    await openMenu({ account, memberships });

    await vi.waitFor(() => expect(itemNames()).toEqual(actions));
  });

  it('gives a guest no menu at all', async () => {
    const { article } = await renderComment();

    expect(article.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it.each([
    { status: 'published', top: {}, choices: MODERATION },
    {
      status: 'held',
      top: { status: 'held' },
      choices: ['Approve', 'Remove', 'Shadow ban user', 'Ban user', 'Lift restriction'],
    },
    {
      status: 'hidden',
      top: { status: 'hidden' },
      choices: ['Unhide', 'Remove', 'Shadow ban user', 'Ban user', 'Lift restriction'],
    },
  ] as const)('offers the owner of a $status comment $choices', async ({ top, choices }) => {
    const { user } = await openMenu({ account: OWNER.account, top: { ...top } });

    await user.click(screen.getByRole('menuitem', { name: 'Moderate' }));

    await vi.waitFor(() => expect(itemNames().slice(-choices.length)).toEqual(choices));
  });

  it.each([
    {
      why: 'the author is the channel creator',
      top: { author: { ...comment().author, isCreator: true } },
    },
    { why: 'the author is the viewer', top: { author: { ...comment().author, userId: OWNER_ID } } },
  ])('leaves the user actions out when $why', async ({ top }) => {
    const { user } = await openMenu({ account: OWNER.account, top });

    await user.click(screen.getByRole('menuitem', { name: 'Moderate' }));

    await vi.waitFor(() => expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeVisible());
    expect(screen.queryByRole('menuitem', { name: 'Ban user' })).not.toBeInTheDocument();
  });

  it.each([
    { top: {}, label: 'Pin', method: 'POST' },
    { top: { isPinned: true }, label: 'Unpin', method: 'DELETE' },
  ])('sends $method from $label', async ({ top, label, method }) => {
    const sent: string[] = [];
    const handlers = [pinComment, unpinComment].map((contract) =>
      mockEndpoint(contract, ({ request, params }) => {
        sent.push(`${request.method} ${params.id}`);
        return HttpResponse.json(comment(top));
      })
    );
    const { user } = await openMenu({ account: OWNER.account, top, handlers });

    await user.click(screen.getByRole('menuitem', { name: label }));

    await vi.waitFor(() => expect(sent).toEqual([`${method} ${COMMENT_ID}`]));
  });

  it.each([
    { name: 'a reply', top: { parentId: OTHER_ID } },
    { name: 'a held comment', top: { status: 'held' as const } },
  ])('offers no pin on $name', async ({ top }) => {
    await openMenu({ account: OWNER.account, top });

    expect(itemNames()).not.toContain('Pin');
  });

  it.each([
    {
      top: { status: 'held' as const },
      choice: 'Approve',
      body: { action: 'approve' },
      toast: 'The comment is approved',
    },
    {
      top: { status: 'hidden' as const },
      choice: 'Unhide',
      body: { action: 'unhide' },
      toast: 'The comment is visible again',
    },
  ])('sends $choice at once and says so', async ({ top, choice, body, toast }) => {
    const sent: unknown[] = [];
    const handler = mockEndpoint(moderateComment, async ({ request, params }) => {
      sent.push({ id: params.id, ...(await request.json()) });
      return HttpResponse.json({ state: 'published', comment: comment() });
    });
    const { user } = await openMenu({ account: OWNER.account, top, handlers: [handler] });

    await chooseModeration(user, choice);

    expect(await screen.findByText(toast)).toBeInTheDocument();
    expect(sent).toEqual([{ id: COMMENT_ID, ...body }]);
  });

  it('lifts the restriction on the author of the comment on the video channel', async () => {
    const lifted: unknown[] = [];
    const handler = mockEndpoint(liftRestriction, ({ request, params }) => {
      lifted.push([params.userId, request.headers.get('x-channel-id')]);
      return new HttpResponse(null, { status: 204 });
    });
    const { user } = await openMenu({ account: OWNER.account, handlers: [handler] });

    await chooseModeration(user, 'Lift restriction');

    expect(await screen.findByText('The restriction is lifted')).toBeInTheDocument();
    expect(lifted).toEqual([[AUTHOR_ID, expect.any(String)]]);
  });
});
