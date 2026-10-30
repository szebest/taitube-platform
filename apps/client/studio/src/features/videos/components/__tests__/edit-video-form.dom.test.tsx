import { screen, within } from '@testing-library/react';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { GAMING, MUSIC, serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';

const stored = video({
  title: 'Lisbon at night',
  description: 'Shot on **film**',
  visibility: 'private',
  categoryId: MUSIC,
  tags: ['night'],
  version: 3,
  posterUrl: 'http://cdn.test/poster.jpg',
  thumbnailUrl: 'http://cdn.test/custom.jpg',
});

async function renderEditor(options?: { conflicts?: number; stored?: typeof stored }) {
  const served = serveEditor(options?.stored ?? stored, options);
  const rendered = await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('textbox', { name: 'Video title' });
  return { ...rendered, ...served };
}

const save = () => screen.getByRole('button', { name: 'Save changes' });

describe('apps/client/studio: EditVideoForm', () => {
  it('opens on the video as stored, with its category named from the public categories', async () => {
    await renderEditor();

    expect(screen.getByRole('textbox', { name: 'Video title' })).toHaveValue('Lisbon at night');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Shot on **film**');
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveTextContent('Private');
    await vi.waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Music')
    );
    expect(screen.getByRole('button', { name: 'Remove the tag night' })).toBeInTheDocument();
  });

  it('sends every field with the version the video was loaded at, and confirms the save', async () => {
    const { user, edits } = await renderEditor();

    await user.clear(screen.getByRole('textbox', { name: 'Video title' }));
    await user.type(screen.getByRole('textbox', { name: 'Video title' }), 'Harbour at dawn');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Gaming' }));
    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'harbour{Enter}');
    await user.click(save());

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    expect(edits).toEqual([
      {
        title: 'Harbour at dawn',
        description: 'Shot on **film**',
        visibility: 'private',
        categoryId: GAMING,
        tags: ['night', 'harbour'],
        version: 3,
      },
    ]);
  });

  it('shows the rule a title breaks, and holds the save back until it is fixed', async () => {
    const { user } = await renderEditor();

    await user.clear(screen.getByRole('textbox', { name: 'Video title' }));

    expect(await screen.findByText(/title must be between 1 and 255 characters/)).toBeInTheDocument();
    expect(save()).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Video title' }), 'Back');

    await vi.waitFor(() => expect(save()).toBeEnabled());
  });

  it('previews the description as markdown, never as markup or a remote image', async () => {
    const { user } = await renderEditor();
    const description = screen.getByRole('textbox', { name: 'Description' });

    await user.clear(description);
    await user.type(description, 'Hello **world** <b>raw</b> ![x](http://evil.test/p.png)');

    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(within(preview).getByText('world').tagName).toBe('STRONG');
    expect(preview.querySelector('b, img')).toBeNull();
  });

  it('keeps the thumbnail it has unless the generated frame is chosen, then sends that choice', async () => {
    const { user, edits } = await renderEditor();
    const poster = screen.getByRole('button', { name: 'Use the generated frame' });
    expect(poster).toHaveAttribute('aria-pressed', 'false');

    await user.click(save());
    await screen.findByText('Changes saved');
    expect(edits[0]).not.toHaveProperty('selectedThumbnail');

    await user.click(poster);
    await user.click(save());

    await vi.waitFor(() => expect(edits).toHaveLength(2));
    expect(edits[1]).toMatchObject({ selectedThumbnail: { source: 'poster' } });
  });

  it('offers no generated frame when the poster is already the thumbnail', async () => {
    await renderEditor({
      stored: video({ posterUrl: 'http://cdn.test/p.jpg', thumbnailUrl: 'http://cdn.test/p.jpg' }),
    });

    expect(screen.queryByRole('button', { name: 'Use the generated frame' })).not.toBeInTheDocument();
  });

  describe('when the API reports the video moved on', () => {
    it('opens the conflict dialog and keeps the typed values, saving nothing', async () => {
      const { user } = await renderEditor({ conflicts: 1 });

      await user.type(screen.getByRole('textbox', { name: 'Video title' }), ' (cut)');
      await user.click(save());

      expect(
        await screen.findByRole('dialog', { name: 'This video changed while you were editing it' })
      ).toBeInTheDocument();
      expect(screen.queryByText('Changes saved')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Video title', hidden: true })).toHaveValue(
        'Lisbon at night (cut)'
      );
    });

    it('reloads the stored video into the form when the creator drops their edits', async () => {
      const { user, api } = await renderEditor({ conflicts: 1 });
      await user.type(screen.getByRole('textbox', { name: 'Video title' }), ' (cut)');
      await user.click(save());
      await screen.findByRole('dialog');
      api.stored = { ...api.stored, title: 'Edited elsewhere', version: 4 };

      await user.click(screen.getByRole('button', { name: 'Reload' }));

      await vi.waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Video title' })).toHaveValue('Edited elsewhere')
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('saves the typed values over the newer version when the creator overwrites', async () => {
      const { user, api, edits } = await renderEditor({ conflicts: 1 });
      await user.type(screen.getByRole('textbox', { name: 'Video title' }), ' (cut)');
      await user.click(save());
      await screen.findByRole('dialog');
      api.stored = { ...api.stored, title: 'Edited elsewhere', version: 4 };

      await user.click(screen.getByRole('button', { name: 'Overwrite' }));

      expect(await screen.findByText('Changes saved')).toBeInTheDocument();
      expect(edits.map((edit) => edit['version'])).toEqual([3, 4]);
      expect(edits[1]).toMatchObject({ title: 'Lisbon at night (cut)' });
    });
  });
});
