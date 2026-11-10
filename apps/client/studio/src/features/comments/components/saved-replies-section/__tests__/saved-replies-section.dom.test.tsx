import { screen, within } from '@testing-library/react';
import { renderSettings } from '#app/features/comments/__tests__/render-settings';

const reply = (n: number) => ({
  id: `0190c3a0-5e1d-7000-8000-00000000a0${String(n).padStart(2, '0')}`,
  title: `Reply ${n}`,
  body: `Body ${n}`,
  position: n,
});

const section = () => within(screen.getByRole('region', { name: 'Saved replies' }));

describe('apps/client/studio: SavedRepliesSection', () => {
  it('says there are none yet', async () => {
    await renderSettings();

    expect(await section().findByText('No saved replies yet.')).toBeInTheDocument();
  });

  it('adds a reply from a title and a body', async () => {
    const { user, sent } = await renderSettings();

    await user.click(await section().findByRole('button', { name: 'Add a reply' }));
    expect(section().getByRole('button', { name: 'Save reply' })).toBeDisabled();
    await user.type(section().getByRole('textbox', { name: 'Title' }), ' Thanks ');
    await user.type(section().getByRole('textbox', { name: 'Reply' }), 'Thank you for watching!');
    await user.click(section().getByRole('button', { name: 'Save reply' }));

    expect(await section().findByText('Thank you for watching!')).toBeInTheDocument();
    expect(sent.replies).toEqual([
      { method: 'POST', body: { title: 'Thanks', body: 'Thank you for watching!' } },
    ]);
  });

  it('edits a reply in place and deletes another', async () => {
    const { user, sent } = await renderSettings({ replies: [reply(1), reply(2)] });

    await user.click(await section().findByRole('button', { name: 'Edit Reply 1' }));
    await user.clear(section().getByRole('textbox', { name: 'Reply' }));
    await user.type(section().getByRole('textbox', { name: 'Reply' }), 'Changed');
    await user.click(section().getByRole('button', { name: 'Save reply' }));
    expect(await section().findByText('Changed')).toBeInTheDocument();
    await user.click(section().getByRole('button', { name: 'Delete Reply 2' }));

    await vi.waitFor(() => expect(section().queryByText('Body 2')).not.toBeInTheDocument());
    expect(sent.replies.map(({ method }) => method)).toEqual(['PATCH', 'DELETE']);
    expect(sent.replies[0]?.body).toEqual({ title: 'Reply 1', body: 'Changed' });
  });

  it('holds the add at 20 replies and says why', async () => {
    await renderSettings({ replies: Array.from({ length: 20 }, (_, n) => reply(n)) });

    expect(await section().findByText(/20 saved replies/)).toBeInTheDocument();
    expect(section().getByRole('button', { name: 'Add a reply' })).toBeDisabled();
  });
});
