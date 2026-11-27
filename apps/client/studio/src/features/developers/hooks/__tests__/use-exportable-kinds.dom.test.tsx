import { screen, within } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

describe('apps/client/studio: useExportableKinds', () => {
  it.each<{ role?: ChannelRole; kinds: string[] }>([
    { kinds: ['Video analytics', 'Channel analytics', 'Comments', 'Videos', 'Posts'] },
    {
      role: 'manager',
      kinds: ['Video analytics', 'Channel analytics', 'Comments', 'Videos', 'Posts'],
    },
    { role: 'analytics', kinds: ['Video analytics', 'Channel analytics'] },
  ])('lets the owner or a $role export $kinds', async ({ role, kinds }) => {
    const { user } = await renderDevelopers({ role });

    await user.click(
      within(screen.getByRole('region', { name: 'Exports' })).getByRole('button', {
        name: 'Request export',
      })
    );
    await user.click(await screen.findByRole('combobox', { name: 'Data' }));

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(
      kinds
    );
  });
});
