import { screen, within } from '@testing-library/react';
import { viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

async function openForm() {
  const rendered = await renderThreads({ viewer: viewerAccount() });
  const [start] = screen.getAllByRole('button', { name: 'Start a thread at 01:15' });
  if (!start) throw new Error('no start action');
  await rendered.user.click(start);
  const dialog = await screen.findByRole('dialog', { name: 'Start a thread' });
  return { ...rendered, dialog: within(dialog) };
}

describe('apps/client/web: ThreadFormDialog', () => {
  it('names the moment and keeps Start thread off until there is a title', async () => {
    const { user, dialog } = await openForm();
    const submit = dialog.getByRole('button', { name: 'Start thread' });

    expect(
      screen.getByText('Talk about 01:15. The thread shows on the seek bar once it has replies.')
    ).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.type(dialog.getByRole('textbox', { name: 'Title' }), '   ');

    expect(submit).toBeDisabled();

    await user.type(dialog.getByRole('textbox', { name: 'Title' }), 'Real title');

    expect(submit).toBeEnabled();
  });

  it.each([
    { field: 'Title', max: 100, counter: '100 / 100' },
    { field: 'Details (optional)', max: 1000, counter: '1,000 / 1,000' },
  ])('counts the $field and stops at $max characters', async ({ field, max, counter }) => {
    const { user, dialog } = await openForm();
    const box = dialog.getByRole('textbox', { name: field });

    await user.click(box);
    await user.paste('x'.repeat(max + 20));

    expect(box).toHaveValue('x'.repeat(max));
    expect(dialog.getByText(counter)).toBeInTheDocument();
  });

  it('closes on Cancel without sending anything', async () => {
    const { user, dialog, sent } = await openForm();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Start a thread' })).not.toBeInTheDocument();
    expect(sent.threads).toEqual([]);
  });
});
