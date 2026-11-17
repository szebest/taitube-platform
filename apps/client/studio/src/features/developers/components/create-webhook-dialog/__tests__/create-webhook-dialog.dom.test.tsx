import { screen, within } from '@testing-library/react';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

async function openDialog() {
  const rendered = await renderDevelopers();
  const section = screen.getByRole('region', { name: 'Webhooks' });
  await rendered.user.click(within(section).getByRole('button', { name: 'Add webhook' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Add a webhook' }) };
}

describe('apps/client/studio: CreateWebhookDialog', () => {
  it('offers every event, export.ready and comment.held among them, and asks for one', async () => {
    const { user, dialog, requests } = await openDialog();

    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(4);
    expect(within(dialog).getByRole('checkbox', { name: 'Export ready' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Comment held' })
    ).toHaveAccessibleDescription('A comment waits for review. Ids only, never the text.');

    await user.type(
      within(dialog).getByRole('textbox', { name: /Payload address/ }),
      'https://hooks.example.com/in'
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add webhook' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Pick at least one event.');
    expect(requests.webhooks).toEqual([]);
  });

  it('adds the webhook and shows its signing secret once', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.type(
      within(dialog).getByRole('textbox', { name: /Payload address/ }),
      'https://hooks.example.com/in'
    );
    await user.click(within(dialog).getByRole('checkbox', { name: 'Export ready' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Comment held' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add webhook' }));

    const reveal = await screen.findByRole('dialog', { name: 'Copy the signing secret' });
    expect(requests.webhooks).toEqual([
      { url: 'https://hooks.example.com/in', events: ['export.ready', 'comment.held'] },
    ]);
    expect(within(reveal).getByRole('textbox', { name: 'Signing secret' })).toHaveValue(
      'a'.repeat(64)
    );
    await user.click(
      within(reveal).getByRole('checkbox', { name: 'I saved this secret somewhere safe' })
    );
    await user.click(within(reveal).getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
