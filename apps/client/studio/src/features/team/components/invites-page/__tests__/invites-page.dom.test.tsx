import { screen, within } from '@testing-library/react';
import { listMyInvites } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { MY_INVITE_ID, myInvite } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: InvitesPage', () => {
  it('lists each invite with its channel, the role and what it can do, the inviter and the expiry', async () => {
    await renderTeam('/invites', { state: { myInvites: [myInvite('editor')] } });

    const list = await screen.findByRole('list', { name: 'Pending invites' });

    expect(within(list).getByText('Other Show')).toBeInTheDocument();
    expect(within(list).getByText('@othershow')).toBeInTheDocument();
    expect(within(list).getByText('Editor')).toBeInTheDocument();
    expect(
      within(list).getByText('Uploads and edits videos and the channel page.')
    ).toBeInTheDocument();
    expect(within(list).getByText(/Invited by Olivia Owner/)).toBeInTheDocument();
    expect(within(list).getByRole('time')).toHaveAttribute('datetime', '2026-01-15T00:00:00.000Z');
  });

  it('marks the invite a notification opened', async () => {
    await renderTeam(`/invites?invite=${MY_INVITE_ID}`, {
      state: { myInvites: [myInvite('editor')] },
    });

    expect(await screen.findByRole('listitem')).toHaveAttribute('aria-current', 'true');
  });

  it('shows a skeleton while the invites load', async () => {
    await renderTeam('/invites', {
      handlers: [mockEndpoint(listMyInvites, () => new Promise(() => undefined))],
    });

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('says there is nothing to answer', async () => {
    await renderTeam('/invites');

    expect(await screen.findByText('No invites')).toBeInTheDocument();
  });

  it.each([
    { scenario: 'a failure', code: ErrorCodes.INTERNAL, shown: 'Your invites did not load.' },
    { scenario: 'a refusal', code: ErrorCodes.FORBIDDEN, shown: 'Sign in to see your invites' },
  ])('shows $scenario as its own state', async ({ code, shown }) => {
    await renderTeam('/invites', {
      handlers: [mockEndpoint(listMyInvites, () => problemReply(code))],
    });

    expect(await screen.findByText(shown)).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const third = myInvite('analytics', {
      id: '0190c3a0-5e1d-7000-8000-0000000dd003',
      channel: { ...myInvite('analytics').channel, displayName: 'Third Show', handle: 'third' },
    });
    const { user } = await renderTeam('/invites', {
      handlers: [
        mockEndpoint(listMyInvites, ({ request }) =>
          new URL(request.url).searchParams.has('cursor')
            ? HttpResponse.json({ items: [third], nextCursor: null })
            : HttpResponse.json({ items: [myInvite('editor')], nextCursor: 'next' })
        ),
      ],
    });

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Third Show')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    await renderTeam('/invites', { state: { myInvites: [myInvite('editor')] } });
    await screen.findByRole('list', { name: 'Pending invites' });

    expect(await axeViolations()).toEqual([]);
  });
});
