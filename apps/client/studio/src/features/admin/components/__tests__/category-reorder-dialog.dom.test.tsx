import { screen, waitFor, within } from '@testing-library/react';

import { adminCategory, renderCategories } from './categories.fixture';

const MUSIC = adminCategory({ name: 'Music', slug: 'music', sortOrder: 0 });
const GAMING = adminCategory({ name: 'Gaming', slug: 'gaming', sortOrder: 1 });
const NEWS = adminCategory({ name: 'News', slug: 'news', sortOrder: 2 });
const ROW_HEIGHT = 40;

const openReorder = async () => {
  const rendered = await renderCategories([MUSIC, GAMING, NEWS]);
  await rendered.user.click(await screen.findByRole('button', { name: 'Reorder' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Reorder categories' }) };
};

describe('apps/client/studio: CategoryReorderDialog', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const row = this.closest('li');
      const top = row ? [...(row.parentElement?.children ?? [])].indexOf(row) * ROW_HEIGHT : 0;
      return new DOMRect(0, top, 300, row ? ROW_HEIGHT : 0);
    });
  });

  it('moves a category with Space and the arrows, announces it and saves only the rows that moved', async () => {
    const { user, requests, dialog } = await openReorder();

    within(dialog).getByRole('button', { name: 'Reorder Music' }).focus();
    await user.keyboard('[Space]');
    expect(await screen.findByText('Picked up Music, position 1 of 3')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved to position 2')).toBeInTheDocument();
    expect(requests.updated).toEqual([]);
    await user.keyboard('[Space]');

    await waitFor(() => expect(requests.updated).toHaveLength(2));
    expect(requests.updated).toEqual(
      expect.arrayContaining([
        { id: GAMING.id, body: { sortOrder: 0 } },
        { id: MUSIC.id, body: { sortOrder: 1 } },
      ])
    );
  });
});
