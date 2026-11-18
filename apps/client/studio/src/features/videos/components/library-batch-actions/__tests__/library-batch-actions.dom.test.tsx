import { screen, waitFor, within } from '@testing-library/react';
import { listCategories } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { creatorVideo, videoIdOf } from '#app/__tests__/creator-video.fixture';
import { serveLibrary, serveManagement } from '#app/__tests__/library-api.fixture';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const TITLES = ['Lisbon at night', 'Harbour at dawn', 'Night bus to Porto'];

async function renderLibrary(failing: readonly string[] = []) {
  const library = serveLibrary([
    {
      cursor: null,
      items: TITLES.map((title, index) =>
        creatorVideo({ id: videoIdOf(index), title, version: index + 2 })
      ),
      next: null,
    },
  ]);
  const requests = serveManagement(failing);
  apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([])));
  const rendered = await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });
  await screen.findByRole('table', { name: 'Your videos' });
  return { ...rendered, library, requests };
}

async function select(
  user: Awaited<ReturnType<typeof renderLibrary>>['user'],
  ...titles: string[]
) {
  for (const title of titles) {
    await user.click(screen.getByRole('checkbox', { name: new RegExp(title) }));
  }
}

const selectedAnnouncement = () =>
  screen.getByText(/\d+ selected/, { selector: '[role="status"]' });

const batchBar = () => document.querySelector<HTMLElement>('[data-slot="data-table-batch"]');

type User = Awaited<ReturnType<typeof renderLibrary>>['user'];

describe('apps/client/studio: LibraryBatchActions', () => {
  it('shows the batch actions only while rows are selected', async () => {
    const { user } = await renderLibrary();

    expect(batchBar()).toHaveAttribute('data-state', 'closed');

    await select(user, TITLES[0] as string);

    expect(batchBar()).toHaveAttribute('data-state', 'open');
    expect(within(batchBar() as HTMLElement).getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('deletes the selected videos after the confirmation and reports how many', async () => {
    const { user, requests } = await renderLibrary();
    await select(user, TITLES[0] as string, TITLES[1] as string);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 videos?' });
    expect(requests).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('2 videos deleted')).toBeInTheDocument();
    expect(requests.map(({ method, id }) => `${method} ${id}`).sort()).toEqual([
      `DELETE ${videoIdOf(0)}`,
      `DELETE ${videoIdOf(1)}`,
    ]);
    await waitFor(() => expect(batchBar()).toHaveAttribute('data-state', 'closed'));
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    const { user, requests } = await renderLibrary();
    await select(user, TITLES[0] as string);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' })
    );

    expect(requests).toEqual([]);
    expect(batchBar()).toHaveAttribute('data-state', 'open');
    expect(selectedAnnouncement()).toHaveTextContent('1 selected');
  });

  it.each(['Public', 'Unlisted', 'Private'])(
    'sets the selected videos %s through the field dialog, in one request',
    async (label) => {
      const { user, requests } = await renderLibrary();
      await select(user, TITLES[0] as string, TITLES[2] as string);

      await user.click(
        within(batchBar() as HTMLElement).getByRole('button', { name: 'Visibility' })
      );
      const dialog = await screen.findByRole('dialog', { name: 'Change the visibility' });
      expect(dialog).toHaveAccessibleDescription('Applies to 2 selected videos.');
      await user.click(within(dialog).getByRole('combobox', { name: /Visibility/ }));
      await user.click(await screen.findByRole('option', { name: label }));
      await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

      expect(await screen.findByText('2 videos updated')).toBeInTheDocument();
      expect(requests).toEqual([
        {
          method: 'POST',
          id: 'bulk',
          body: {
            ids: [videoIdOf(0), videoIdOf(2)],
            patch: { visibility: label.toLowerCase() },
          },
        },
      ]);
    }
  );

  it.each([
    {
      action: 'Add tags',
      dialog: 'Add tags',
      fill: async (user: User, dialog: HTMLElement) =>
        user.type(within(dialog).getByRole('textbox', { name: /Tags to add/ }), 'travel, food'),
      patch: { addTags: ['travel', 'food'] },
    },
    {
      action: 'Remove tags',
      dialog: 'Remove tags',
      fill: async (user: User, dialog: HTMLElement) =>
        user.type(within(dialog).getByRole('textbox', { name: /Tags to remove/ }), 'old'),
      patch: { removeTags: ['old'] },
    },
    {
      action: 'Comments',
      dialog: 'Turn comments on or off',
      fill: async (user: User, dialog: HTMLElement) => {
        await user.click(within(dialog).getByRole('combobox', { name: /Comments/ }));
        await user.click(await screen.findByRole('option', { name: 'Turned off' }));
      },
      patch: { commentsEnabled: false },
    },
    {
      action: 'Category',
      dialog: 'Change the category',
      fill: async () => undefined,
      patch: { categoryId: null },
    },
  ])('applies $action to the selection through the same dialog', async (row) => {
    const { user, requests } = await renderLibrary();
    await select(user, TITLES[0] as string);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: row.action }));
    const dialog = await screen.findByRole('dialog', { name: row.dialog });
    await row.fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('1 video updated')).toBeInTheDocument();
    expect(requests).toEqual([
      { method: 'POST', id: 'bulk', body: { ids: [videoIdOf(0)], patch: row.patch } },
    ]);
  });

  it('lists the videos a bulk edit refused, with the code, and keeps them selected', async () => {
    const { user } = await renderLibrary([videoIdOf(1)]);
    await select(user, ...TITLES);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: 'Comments' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn comments on or off' });
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(
      await screen.findByText('2 of 3 done, 1 failed. The failed ones stay selected.')
    ).toBeInTheDocument();
    expect(await screen.findByText(/Harbour at dawn \(VIDEO_NOT_FOUND\)/)).toBeInTheDocument();
    await waitFor(() => expect(selectedAnnouncement()).toHaveTextContent('1 selected'));
  });

  it('reports a partial failure and keeps the failed videos selected', async () => {
    const { user } = await renderLibrary([videoIdOf(1)]);
    await select(user, ...TITLES);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' })
    );

    expect(
      await screen.findByText('2 of 3 done, 1 failed. The failed ones stay selected.')
    ).toBeInTheDocument();
    await waitFor(() => expect(selectedAnnouncement()).toHaveTextContent('1 selected'));
    expect(screen.getByRole('row', { selected: true })).toHaveTextContent(TITLES[1] as string);
  });

  it('says nothing was changed when every request fails', async () => {
    const { user } = await renderLibrary(TITLES.map((_, index) => videoIdOf(index)));
    await select(user, TITLES[0] as string);

    await user.click(within(batchBar() as HTMLElement).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' })
    );

    expect(await screen.findByText('Nothing was changed. Try again.')).toBeInTheDocument();
  });

  it('deletes one video from its row menu after the confirmation', async () => {
    const { user, requests } = await renderLibrary();

    await user.click(screen.getByRole('button', { name: 'Actions for Harbour at dawn' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this video?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('1 video deleted')).toBeInTheDocument();
    expect(requests).toEqual([{ method: 'DELETE', id: videoIdOf(1), body: null }]);
  });

  it('sets the visibility of one video from its row menu', async () => {
    const { user, requests } = await renderLibrary();

    await user.click(screen.getByRole('button', { name: 'Actions for Harbour at dawn' }));
    (await screen.findByRole('menuitem', { name: 'Visibility' })).focus();
    await user.keyboard('{ArrowRight}');
    (await screen.findByRole('menuitem', { name: 'Unlisted' })).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('1 video updated')).toBeInTheDocument();
    expect(requests).toEqual([
      {
        method: 'POST',
        id: 'bulk',
        body: { ids: [videoIdOf(1)], patch: { visibility: 'unlisted' } },
      },
    ]);
  });
});
