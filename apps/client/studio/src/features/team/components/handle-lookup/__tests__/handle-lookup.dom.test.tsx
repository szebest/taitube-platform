import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';

async function openLookup() {
  const rendered = await renderTeam();
  await rendered.user.click(
    (await screen.findAllByRole('button', { name: 'Invite someone' }))[0] as HTMLElement
  );
  const dialog = await screen.findByRole('dialog', { name: 'Invite to the team' });
  return { ...rendered, search: within(dialog).getByRole('combobox'), dialog };
}

describe('apps/client/studio: HandleLookup', () => {
  it('finds the channel behind a handle typed with its @ and offers it by name', async () => {
    const { user, search, dialog } = await openLookup();

    await user.type(search, '@newcomer');

    expect(await within(dialog).findByRole('option', { name: /New Comer/ })).toHaveTextContent(
      '@newcomer'
    );
  });

  it('puts the handle in the field and names the channel once it is picked', async () => {
    const { user, search, dialog } = await openLookup();

    await user.type(search, 'newcomer');
    await user.click(await within(dialog).findByRole('option', { name: /New Comer/ }));

    expect(search).toHaveValue('newcomer');
    expect(within(dialog).getByText('Inviting New Comer (@newcomer)')).toBeInTheDocument();
  });

  it('offers nothing before there is a handle, and says so for one that nobody has', async () => {
    const { user, search, dialog } = await openLookup();

    expect(within(dialog).queryByRole('option')).toBeNull();
    expect(within(dialog).queryByText('No channel has that handle')).toBeNull();

    await user.type(search, 'nobody');

    expect(await within(dialog).findByText('No channel has that handle')).toBeInTheDocument();
  });
});
