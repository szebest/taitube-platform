import { screen } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { myInvite } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: useMyInvites', () => {
  it('reads the invites the API lists, so the page and the navigation count the same ones', async () => {
    await renderTeam('/invites', { state: { myInvites: [myInvite('editor')] } });

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Invites/ })).toHaveTextContent('1');
  });
});
