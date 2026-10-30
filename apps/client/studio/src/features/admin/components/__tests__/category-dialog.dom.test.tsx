import { screen, waitFor, within } from '@testing-library/react';
import { createCategory } from '@vp/api-contracts';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import type { HttpHandler } from 'msw';

import { adminCategory, renderCategories } from './categories.fixture';

const MUSIC = adminCategory({ name: 'Music', slug: 'music', sortOrder: 4, description: 'Songs' });

const openDialog = async (name: 'New category' | 'Edit Music', handlers: HttpHandler[] = []) => {
  const rendered = await renderCategories([MUSIC], { handlers });
  await rendered.user.click(await screen.findByRole('button', { name }));
  return { ...rendered, dialog: await screen.findByRole('dialog') };
};

const fill = async (
  user: Awaited<ReturnType<typeof openDialog>>['user'],
  fields: { Name?: string; Slug?: string }
) => {
  for (const [label, text] of Object.entries(fields)) {
    if (text) {
      await user.type(screen.getByLabelText(label), text);
    }
  }
};

describe('apps/client/studio: CategoryDialog', () => {
  it('creates a category at the end of the order from trimmed, validated fields', async () => {
    const { user, requests } = await openDialog('New category');

    await fill(user, { Name: '  Live music ', Slug: 'live-music' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests.created).toEqual([
        { name: 'Live music', slug: 'live-music', description: null, sortOrder: 5 },
      ])
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([
    { fields: { Name: '', Slug: 'music' }, message: /at most|between|length/i, label: 'Name' },
    { fields: { Name: 'Music', Slug: 'Not A Slug' }, message: /Slug must match/, label: 'Slug' },
  ])('refuses $label $fields and sends nothing', async ({ fields, message, label }) => {
    const { user, requests, dialog } = await openDialog('New category');

    await fill(user, { Name: fields.Name, Slug: fields.Slug });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(label)).toBeInvalid();
    expect(requests.created).toEqual([]);
  });

  it('edits a category with its values in the fields', async () => {
    const { user, requests } = await openDialog('Edit Music');

    expect(screen.getByLabelText('Name')).toHaveValue('Music');
    expect(screen.getByLabelText('Description')).toHaveValue('Songs');
    await user.type(screen.getByLabelText('Name'), ' videos');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests.updated).toEqual([
        { id: MUSIC.id, body: { name: 'Music videos', slug: 'music', description: 'Songs' } },
      ])
    );
  });

  it('points at the slug when another category already has it', async () => {
    const { user } = await openDialog('New category', [
      mockEndpoint(createCategory, () => problemReply('CATEGORY_SLUG_CONFLICT')),
    ]);

    await fill(user, { Name: 'Music', Slug: 'music' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Another category already uses this slug.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
