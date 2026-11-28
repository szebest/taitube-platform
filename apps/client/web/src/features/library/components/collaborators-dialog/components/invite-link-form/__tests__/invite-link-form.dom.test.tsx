import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor, within } from '@testing-library/react';
import { createPlaylistInviteLink } from '@vp/api-contracts';
import { PLAYLIST_INVITE_DEFAULT_DAYS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { invite } from '#app/features/library/__tests__/playlist-people';
import { LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { InviteLinkForm } from '../invite-link-form';

async function renderForm(refused = false) {
  const bodies: unknown[] = [];
  const rendered = await renderPart(<InviteLinkForm playlistId={LIST} />, {
    handlers: [
      mockEndpoint(createPlaylistInviteLink, async ({ request }) => {
        bodies.push(await request.json());
        return refused
          ? problemReply(ErrorCodes.RATE_LIMITED)
          : HttpResponse.json(invite(2), { status: 201 });
      }),
    ],
  });
  return {
    ...rendered,
    bodies,
    form: within(screen.getByRole('form', { name: 'Invite link' })),
  };
}

describe('apps/client/web: the invite link form', () => {
  it('creates a contributor link with the default expiry and no use limit', async () => {
    const { user, form, bodies } = await renderForm();

    expect(await axeViolations()).toEqual([]);
    await user.click(form.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        { role: 'contributor', expiresInDays: PLAYLIST_INVITE_DEFAULT_DAYS, maxUses: null },
      ])
    );
    expect(await screen.findByText('Invite link created')).toBeInTheDocument();
  });

  it('creates the link with the role, expiry and uses chosen', async () => {
    const { user, form, bodies } = await renderForm();

    await user.click(form.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    await user.click(form.getByRole('combobox', { name: 'Expires after' }));
    await user.click(await screen.findByRole('option', { name: '14 days' }));
    await user.click(form.getByRole('combobox', { name: 'Uses' }));
    await user.click(await screen.findByRole('option', { name: '5 uses' }));
    await user.click(form.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ role: 'editor', expiresInDays: 14, maxUses: 5 }])
    );
  });

  it('goes back to no limit when Unlimited is picked again', async () => {
    const { user, form, bodies } = await renderForm();

    await user.click(form.getByRole('combobox', { name: 'Uses' }));
    await user.click(await screen.findByRole('option', { name: '1 use' }));
    await user.click(form.getByRole('combobox', { name: 'Uses' }));
    await user.click(await screen.findByRole('option', { name: 'Unlimited' }));
    await user.click(form.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() => expect(bodies).toEqual([expect.objectContaining({ maxUses: null })]));
  });

  it('shows a refusal under the form', async () => {
    const { user, form } = await renderForm(true);

    await user.click(form.getByRole('button', { name: 'Create invite link' }));

    expect(await form.findByRole('alert')).toBeInTheDocument();
  });
});
