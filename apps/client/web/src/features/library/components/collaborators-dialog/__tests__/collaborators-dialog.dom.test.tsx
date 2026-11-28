import { screen, waitFor, within } from '@testing-library/react';
import {
  changePlaylistCollaboratorRole,
  createPlaylistInviteLink,
  invitePlaylistCollaborator,
  leavePlaylist,
  listPlaylistInvites,
  search,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { present } from '@vp/queries';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import {
  collaborator,
  invite,
  person,
  seated,
  seatedAs,
} from '#app/features/library/__tests__/playlist-people';
import {
  chooseFromMore,
  LAZY,
  LIST,
  renderPlaylist,
} from '#app/features/library/__tests__/render-playlist';
import { LazyCollaboratorsDialog } from '#app/features/library/components/collaborators-dialog/collaborators-dialog.lazy';
import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

const ANA = collaborator(1, 'Ana', { role: 'contributor' });
const BO = { ...person(2, 'Bo'), bio: '', subscriberCount: 0 };

/** The owner's playlist with Ana on it, its Collaborators dialog open; `sent` collects each write. */
async function openCollaborators({
  overrides = {},
  handlers = [],
}: { overrides?: object; handlers?: HttpHandler[] } = {}) {
  const sent: string[] = [];
  const rendered = await renderPlaylist(overrides, [
    ...handlers,
    seated([ANA]),
    mockEndpoint(listPlaylistInvites, () => HttpResponse.json({ items: [invite(1)] })),
    mockEndpoint(changePlaylistCollaboratorRole, async ({ params, request }) => {
      sent.push(`role ${String(params.userId)} ${JSON.stringify(await request.json())}`);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(createPlaylistInviteLink, async ({ request }) => {
      sent.push(`link ${JSON.stringify(await request.json())}`);
      return HttpResponse.json(invite(2), { status: 201 });
    }),
    mockEndpoint(search, () =>
      HttpResponse.json({
        items: [{ type: 'channel', data: BO }],
        nextCursor: null,
        tookMs: 1,
        total: 1,
        fuzzyFallback: false,
      })
    ),
  ]);
  await chooseFromMore(rendered.user, 'Collaborators');
  const dialog = within(await screen.findByRole('dialog', { name: 'Collaborators' }, LAZY));
  return { ...rendered, dialog, sent };
}

beforeAll(() => LazyCollaboratorsDialog.preload());

describe('apps/client/web: the collaborators dialog', () => {
  it('lists the owner and each collaborator, and the owner changes a role', async () => {
    const { user, dialog, sent } = await openCollaborators();

    expect(await dialog.findByText('Ana')).toBeInTheDocument();
    expect(dialog.getByText('Owner')).toBeInTheDocument();

    await user.click(dialog.getByRole('combobox', { name: 'Role of Ana' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));

    await waitFor(() => expect(sent).toEqual([`role ${ANA.userId} {"role":"editor"}`]));
  });

  it.each([
    { outcome: 'invites the channel picked', reply: null },
    { outcome: 'says why beside the form', reply: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS },
  ] as const)('$outcome when inviting by handle', async ({ reply }) => {
    const bodies: unknown[] = [];
    const { user, dialog } = await openCollaborators({
      handlers: [
        mockEndpoint(invitePlaylistCollaborator, async ({ request }) => {
          bodies.push(await request.json());
          return reply ? problemReply(reply) : HttpResponse.json(invite(3), { status: 201 });
        }),
      ],
    });
    const form = within(dialog.getByRole('form', { name: 'Invite by handle' }));

    await user.type(form.getByRole('combobox', { name: 'Channel' }), 'bo');
    await user.click(await screen.findByRole('option', { name: /Bo/ }, LAZY));
    await user.click(form.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    await user.click(form.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(bodies).toEqual([{ handle: 'bo', role: 'editor' }]));
    if (reply) {
      const { tOr } = translatorFor('en');
      expect(await form.findByText(tOr(present({ code: reply }).copy, {}, ''))).toBeInTheDocument();
    }
  });

  it('creates an invite link with its expiry and uses, and lists the pending ones', async () => {
    const { user, dialog, sent } = await openCollaborators();
    const form = within(dialog.getByRole('form', { name: 'Invite link' }));

    expect(await dialog.findByText('Anyone with the link')).toBeInTheDocument();

    await user.click(form.getByRole('combobox', { name: 'Expires after' }));
    await user.click(await screen.findByRole('option', { name: '14 days' }));
    await user.click(form.getByRole('combobox', { name: 'Uses' }));
    await user.click(await screen.findByRole('option', { name: '5 uses' }));
    await user.click(form.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() =>
      expect(sent).toEqual(['link {"role":"contributor","expiresInDays":14,"maxUses":5}'])
    );
  });

  it('lets a collaborator leave, back to their playlists', async () => {
    const left: string[] = [];
    const { user, router } = await renderPlaylist(seatedAs('editor'), [
      seated([ANA], 'editor'),
      mockEndpoint(leavePlaylist, ({ params }) => {
        left.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    ]);

    await chooseFromMore(user, 'Collaborators');
    const dialog = within(await screen.findByRole('dialog', { name: 'Collaborators' }, LAZY));

    expect(dialog.queryByRole('form', { name: 'Invite by handle' })).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Leave playlist' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/feed/playlists'));
    expect(left).toEqual([LIST]);
  });
});
