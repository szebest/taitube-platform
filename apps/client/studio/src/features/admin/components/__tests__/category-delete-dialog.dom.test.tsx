import { screen, waitFor } from '@testing-library/react';

import { adminCategory, renderCategories } from './categories.fixture';

const EMPTY = adminCategory({ name: 'Archive', slug: 'archive' });
const USED = adminCategory({ name: 'Music', slug: 'music', videoCount: 3 });
const USED_INACTIVE = adminCategory({ name: 'Old', slug: 'old', videoCount: 1, isActive: false });

const askToDelete = async (category: typeof EMPTY) => {
  const rendered = await renderCategories([category]);
  await rendered.user.click(await screen.findByRole('button', { name: `Delete ${category.name}` }));
  return { ...rendered, dialog: await screen.findByRole('alertdialog') };
};

describe('apps/client/studio: CategoryDeleteDialog', () => {
  it('names an empty category, focuses Cancel and deletes on confirm', async () => {
    const { user, requests, dialog } = await askToDelete(EMPTY);

    expect(dialog).toHaveAccessibleName('Delete Archive?');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requests.deleted).toEqual([EMPTY.id]));
  });

  it('warns with the count for a category in use and deactivates instead of deleting', async () => {
    const { user, requests, dialog } = await askToDelete(USED);

    expect(dialog).toHaveAccessibleName('Music cannot be deleted');
    expect(dialog).toHaveAccessibleDescription(/Music is used by 3 videos/);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(requests.updated).toEqual([{ id: USED.id, body: { isActive: false } }])
    );
    expect(requests.deleted).toEqual([]);
  });

  it('only warns for a category in use that is already inactive', async () => {
    await askToDelete(USED_INACTIVE);

    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
