import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor, within } from '@testing-library/react';
import { invitePlaylistCollaborator, search } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { invite, person } from '#app/features/library/__tests__/playlist-people';
import { LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { InviteHandleForm } from '../invite-handle-form';

const BO = { ...person(2, 'Bo'), bio: '', subscriberCount: 0 };

async function renderForm(refusal: (typeof ErrorCodes)[keyof typeof ErrorCodes] | null = null) {
  const bodies: unknown[] = [];
  const rendered = await renderPart(<InviteHandleForm playlistId={LIST} />, {
    handlers: [
      mockEndpoint(search, () =>
        HttpResponse.json({
          items: [{ type: 'channel', data: BO }],
          nextCursor: null,
          tookMs: 1,
          total: 1,
          fuzzyFallback: false,
        })
      ),
      mockEndpoint(invitePlaylistCollaborator, async ({ request }) => {
        bodies.push(await request.json());
        return refusal ? problemReply(refusal) : HttpResponse.json(invite(3), { status: 201 });
      }),
    ],
  });
  const form = within(screen.getByRole('form', { name: 'Invite by handle' }));
  const pickBo = async () => {
    await rendered.user.type(form.getByRole('combobox', { name: 'Channel' }), 'bo');
    await rendered.user.click(await screen.findByRole('option', { name: /Bo/ }));
  };
  return { ...rendered, form, bodies, pickBo };
}

describe('apps/client/web: the invite by handle form', () => {
  it('cannot send before a channel is picked', async () => {
    const { form } = await renderForm();

    expect(form.getByRole('button', { name: 'Send invite' })).toBeDisabled();
  });

  it('invites the channel picked in the role chosen, and says so', async () => {
    const { user, form, bodies, pickBo } = await renderForm();

    await pickBo();
    expect(form.getByRole('button', { name: 'Remove Bo' })).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
    await user.click(form.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    await user.click(form.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(bodies).toEqual([{ handle: 'bo', role: 'editor' }]));
    expect(await screen.findByText('Invited Bo')).toBeInTheDocument();
    expect(form.getByRole('combobox', { name: 'Channel' })).toBeInTheDocument();
  });

  it('goes back to searching when the channel picked is removed', async () => {
    const { user, form, pickBo } = await renderForm();

    await pickBo();
    await user.click(form.getByRole('button', { name: 'Remove Bo' }));

    expect(form.getByRole('combobox', { name: 'Channel' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Send invite' })).toBeDisabled();
  });

  it('shows a refusal under the field and keeps the channel', async () => {
    const { user, form, pickBo } = await renderForm(ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS);

    await pickBo();
    await user.click(form.getByRole('button', { name: 'Send invite' }));

    expect(await form.findByText(/already/i)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Remove Bo' })).toBeInTheDocument();
  });
});
