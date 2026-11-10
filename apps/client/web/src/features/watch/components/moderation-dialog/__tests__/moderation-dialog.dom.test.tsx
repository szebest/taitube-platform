import { fireEvent, screen, within } from '@testing-library/react';
import {
  type Account,
  type ChannelMembershipView,
  getCommentSettings,
  moderateComment,
  restrictUser,
} from '@vp/api-contracts';
import { DEFAULT_COMMENT_SETTINGS, type Disclosure } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
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

type Viewing = { viewer: Account; memberships: ChannelMembershipView[] };

const AS_OWNER: Viewing = { viewer: viewerAccount(OWNER_ID), memberships: [] };
const AS_MODERATOR: Viewing = {
  viewer: viewerAccount(OTHER_ID),
  memberships: [membershipOn('moderator')],
};

const channelDefaults = (hide: Disclosure) =>
  mockEndpoint(getCommentSettings, () =>
    HttpResponse.json({
      ...DEFAULT_COMMENT_SETTINGS,
      blockedWords: [],
      linkAllowlist: [],
      disclosure: { ...DEFAULT_COMMENT_SETTINGS.disclosure, hide },
    })
  );

interface Opening {
  choice: string;
  title: string;
  as?: Viewing;
  handlers?: HttpHandler[];
}

async function openDialog({ choice, title, as = AS_OWNER, handlers = [] }: Opening) {
  const { user, article } = await renderComment({ ...as, handlers });
  await user.click(article.getByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Moderate' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: choice }));
  const dialog = within(await screen.findByRole('dialog', { name: title }));

  return { user, dialog };
}

const moderated = (sent: unknown[]) =>
  mockEndpoint(moderateComment, async ({ request, params }) => {
    sent.push({ id: params.id, ...(await request.json()) });
    return HttpResponse.json({ state: 'hidden', comment: comment({ status: 'hidden' }) });
  });

describe('apps/client/web: ModerationDialog', () => {
  it('presets the channel default, asks a visible action for a note and sends it with the reason', async () => {
    const sent: unknown[] = [];
    const { user, dialog } = await openDialog({
      choice: 'Hide',
      title: 'Hide this comment',
      handlers: [channelDefaults('visible'), moderated(sent)],
    });
    const submit = await dialog.findByRole('button', { name: 'Hide' });

    expect(dialog.getByRole('radio', { name: 'Visible' })).toBeChecked();
    expect(submit).toBeDisabled();

    await user.type(dialog.getByRole('textbox', { name: 'Note' }), 'Off the thread');
    await user.click(submit);

    expect(await screen.findByText('The comment is hidden')).toBeInTheDocument();
    expect(sent).toEqual([
      {
        id: COMMENT_ID,
        action: 'hide',
        disclosure: 'visible',
        reason: 'spam',
        note: 'Off the thread',
      },
    ]);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves the choice to the channel default when the viewer cannot read the settings, and sends no disclosure', async () => {
    const sent: unknown[] = [];
    const { user, dialog } = await openDialog({
      choice: 'Hide',
      title: 'Hide this comment',
      as: AS_MODERATOR,
      handlers: [moderated(sent)],
    });

    expect(await dialog.findByRole('radio', { name: 'Silent' })).not.toBeChecked();
    expect(dialog.getByRole('radio', { name: 'Visible' })).not.toBeChecked();
    expect(
      dialog.getByText("The channel's default decides whether the author is told.")
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Hide' }));

    await vi.waitFor(() =>
      expect(sent).toEqual([{ id: COMMENT_ID, action: 'hide', reason: 'spam' }])
    );
  });

  it('flips to Visible and then asks for the note', async () => {
    const { user, dialog } = await openDialog({
      choice: 'Hide',
      title: 'Hide this comment',
      as: AS_MODERATOR,
    });

    await user.click(await dialog.findByRole('radio', { name: 'Visible' }));

    expect(dialog.getByRole('button', { name: 'Hide' })).toBeDisabled();
    expect(dialog.getByText('The author sees what happened and why.')).toBeInTheDocument();
  });

  it('bans for the chosen time on the video channel, with the reason the user will read', async () => {
    const sent: unknown[] = [];
    const restricted = mockEndpoint(restrictUser, async ({ request, params }) => {
      sent.push({
        userId: params.userId,
        channel: request.headers.get('x-channel-id'),
        ...(await request.json()),
      });
      return HttpResponse.json({
        userId: AUTHOR_ID,
        kind: 'ban',
        reason: 'Spam',
        expiresAt: null,
        createdBy: null,
        createdAt: '2026-11-10T09:00:00.000Z',
        user: null,
      });
    });
    const { user, dialog } = await openDialog({
      choice: 'Ban user',
      title: 'Ban this user',
      handlers: [restricted],
    });

    await user.click(await dialog.findByRole('button', { name: 'Ban' }));

    expect(await screen.findByText('The user is banned')).toBeInTheDocument();
    expect(sent).toEqual([
      {
        userId: AUTHOR_ID,
        channel: CHANNEL_ID,
        action: 'ban',
        reason: 'Spam',
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    ]);
  });

  it('shadow bans with nothing to fill in', async () => {
    const sent: unknown[] = [];
    const restricted = mockEndpoint(restrictUser, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({
        userId: AUTHOR_ID,
        kind: 'shadow',
        reason: null,
        expiresAt: null,
        createdBy: null,
        createdAt: '2026-11-10T09:00:00.000Z',
        user: null,
      });
    });
    const { user, dialog } = await openDialog({
      choice: 'Shadow ban user',
      title: 'Shadow ban this user',
      handlers: [restricted],
    });

    expect(dialog.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(await dialog.findByRole('button', { name: 'Shadow ban' }));

    expect(await screen.findByText('The user is shadow banned')).toBeInTheDocument();
    expect(sent).toEqual([{ action: 'shadow_ban' }]);
  });

  it('keeps the dialog open and says what went wrong when the API refuses', async () => {
    const refusing = mockEndpoint(moderateComment, () =>
      problemReply(ErrorCodes.MODERATION_NOT_APPLICABLE)
    );
    const { user, dialog } = await openDialog({
      choice: 'Hide',
      title: 'Hide this comment',
      as: AS_MODERATOR,
      handlers: [refusing],
    });

    await user.click(await dialog.findByRole('button', { name: 'Hide' }));

    expect(await screen.findByText('The action could not be done')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Hide this comment' })).toBeInTheDocument();
  });
});
