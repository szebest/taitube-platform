import { screen, within } from '@testing-library/react';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the selection bar', () => {
  it('counts the picked videos, and Cancel leaves selection mode', async () => {
    const { user } = await renderPlaylist();

    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Tram ride' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Night bus' }));

    const bar = within(screen.getByRole('toolbar', { name: 'Selected videos' }));
    expect(bar.getByText('2 selected')).toBeInTheDocument();
    expect(bar.getByRole('button', { name: 'Move to' })).toBeEnabled();

    await user.click(bar.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('toolbar', { name: 'Selected videos' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Select Tram ride' })).toBeNull();
  });
});
