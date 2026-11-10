import { screen, within } from '@testing-library/react';
import { removeChannelMember } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

const openDialog = async (options: Parameters<typeof renderTeam>[1] = {}) => {
  serveLibrary([{ cursor: null, items: [], next: null }]);
  const rendered = await renderTeam('/team', {
    state: { memberships: [membership('editor')] },
    actingOn: OTHER_CHANNEL_ID,
    ...options,
  });
  await rendered.user.click(screen.getByRole('button', { name: 'Switch channel' }));
  await rendered.user.click(await screen.findByRole('menuitem', { name: 'Leave this team' }));
  return {
    ...rendered,
    dialog: await screen.findByRole('alertdialog', { name: 'Leave Other Show?' }),
  };
};

describe('apps/client/studio: LeaveTeamDialog', () => {
  it('asks first, then leaves as the viewer and lands on their own channel', async () => {
    const { user, requests, router, dialog } = await openDialog();
    expect(requests.removed).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Leave team' }));

    expect(await screen.findByText('You left Other Show')).toBeInTheDocument();
    expect(requests.removed).toEqual([account().user.id]);
    expect(requests.removedFrom).toEqual([OTHER_CHANNEL_ID]);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/videos'));
    expect(screen.queryByRole('button', { name: 'Switch channel' })).toBeNull();
  });

  it('keeps the membership when the viewer thinks again', async () => {
    const { user, requests, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(requests.removed).toEqual([]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('says so when the API refuses, and stays on the team', async () => {
    const { user, router, dialog } = await openDialog({
      handlers: [mockEndpoint(removeChannelMember, () => problemReply(ErrorCodes.INTERNAL))],
    });

    await user.click(within(dialog).getByRole('button', { name: 'Leave team' }));

    expect(await screen.findByText('You did not leave the team.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/team');
  });

  it('passes axe', async () => {
    await openDialog();

    expect(await axeViolations()).toEqual([]);
  });
});
