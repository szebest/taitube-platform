import { screen, waitFor, within } from '@testing-library/react';
import { listAdminCategories } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';

import { adminCategory, renderCategories } from './categories.fixture';

const MUSIC = adminCategory({ name: 'Music', slug: 'music', sortOrder: 0, videoCount: 4 });
const GAMING = adminCategory({ name: 'Gaming', slug: 'gaming', sortOrder: 1, isActive: false });
const NEWS = adminCategory({ name: 'News', slug: 'news', sortOrder: 2 });

const shownNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

describe('apps/client/studio: CategoryTable', () => {
  it('lists every category, active and inactive, in display order', async () => {
    await renderCategories([NEWS, MUSIC, GAMING]);

    expect(await screen.findByText('Gaming')).toBeInTheDocument();
    expect(shownNames()).toEqual(['Music', 'Gaming', 'News']);
    expect(screen.getByRole('switch', { name: 'Active: Gaming' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Active: Music' })).toBeChecked();
  });

  it.each([
    { column: 'Name', clicks: 1, order: ['Gaming', 'Music', 'News'] },
    { column: 'Name', clicks: 2, order: ['News', 'Music', 'Gaming'] },
    { column: 'Videos', clicks: 1, order: ['Music', 'Gaming', 'News'] },
  ])('sorts by $column after $clicks click(s)', async ({ column, clicks, order }) => {
    const { user } = await renderCategories([MUSIC, GAMING, NEWS]);
    await screen.findByText('Gaming');

    for (let click = 0; click < clicks; click += 1) {
      await user.click(screen.getByRole('button', { name: new RegExp(column) }));
    }

    expect(shownNames()).toEqual(order);
  });

  it('saves the active toggle as a patch of that one field', async () => {
    const { user, requests } = await renderCategories([MUSIC, GAMING]);

    await user.click(await screen.findByRole('switch', { name: 'Active: Gaming' }));

    await waitFor(() =>
      expect(requests.updated).toEqual([{ id: GAMING.id, body: { isActive: true } }])
    );
  });

  it('offers the one action an empty list needs', async () => {
    const { user } = await renderCategories([]);

    expect(await screen.findByText('No categories yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'New category' }).at(-1) as HTMLElement);

    expect(await screen.findByRole('dialog', { name: 'New category' })).toBeInTheDocument();
  });

  it('shows a section error with a retry when the load fails, and recovers on it', async () => {
    let failing = true;
    const { user } = await renderCategories([MUSIC], {
      handlers: [
        mockEndpoint(listAdminCategories, () =>
          failing ? problemReply(ErrorCodes.INTERNAL) : HttpResponse.json([MUSIC])
        ),
      ],
    });

    expect(await screen.findByText('The categories did not load.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Music')).toBeInTheDocument();
  });
});
