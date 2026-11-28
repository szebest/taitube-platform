import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor, within } from '@testing-library/react';
import {
  listPlaylistInvites,
  type PlaylistInviteView,
  revokePlaylistInvite,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { invite, person } from '#app/features/library/__tests__/playlist-people';
import { LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { PendingInvites } from '../pending-invites';

async function renderInvites(items: PlaylistInviteView[] | 'refused') {
  const revoked: string[] = [];
  const rendered = await renderPart(<PendingInvites playlistId={LIST} />, {
    handlers: [
      mockEndpoint(listPlaylistInvites, () =>
        items === 'refused' ? problemReply(ErrorCodes.INTERNAL) : HttpResponse.json({ items })
      ),
      mockEndpoint(revokePlaylistInvite, ({ params }) => {
        revoked.push(String(params.inviteId));
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, revoked };
}

describe('apps/client/web: the pending invites', () => {
  it('says when no invites are waiting', async () => {
    await renderInvites([]);

    expect(await screen.findByText('No invites are waiting')).toBeInTheDocument();
  });

  it('says the invites could not be loaded', async () => {
    await renderInvites('refused');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The collaborators could not be loaded'
    );
  });

  it('lists a link and a personal invite with their state, expiry and uses', async () => {
    await renderInvites([
      invite(1, { maxUses: 5, useCount: 2 }),
      invite(2, { invitee: person(3, 'Cy'), role: 'editor' }),
    ]);

    const [link, personal] = await screen.findAllByRole('listitem');

    expect(link).toHaveTextContent(
      /Anyone with the link.*Contributor, expires.*2 of 5 used.*Active/
    );
    expect(personal).toHaveTextContent(/Cy.*Editor, expires.*Active/);
    expect(await axeViolations()).toEqual([]);
  });

  it('copies the address of a link invite, which a personal invite does not offer', async () => {
    const { user } = await renderInvites([invite(1), invite(2, { invitee: person(3, 'Cy') })]);

    const [link, personal] = await screen.findAllByRole('listitem');
    expect(within(personal as HTMLElement).queryByRole('button', { name: 'Copy link' })).toBeNull();
    await user.click(within(link as HTMLElement).getByRole('button', { name: 'Copy link' }));

    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/playlist-invite/token-1`
    );
  });

  it('revokes a working invite, and says so', async () => {
    const { user, revoked } = await renderInvites([invite(1)]);

    await user.click(
      await screen.findByRole('button', { name: 'Revoke the invite for Anyone with the link' })
    );

    await waitFor(() => expect(revoked).toEqual([invite(1).id]));
    expect(await screen.findByText('Invite revoked')).toBeInTheDocument();
  });

  it.each([
    { state: 'expired', label: 'Expired' },
    { state: 'revoked', label: 'Revoked' },
    { state: 'exhausted', label: 'Used up' },
  ] as const)(
    'shows a $state invite as $label with nothing to copy or revoke',
    async ({ state, label }) => {
      await renderInvites([invite(1, { state })]);

      const item = await screen.findByRole('listitem');

      expect(item).toHaveTextContent(label);
      expect(within(item).queryByRole('button')).not.toBeInTheDocument();
    }
  );
});
