import { screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveLibrary, serveManagement } from '#app/features/content/__tests__/library-api.fixture';
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
    'sets the selected videos %s, each against its own version',
    async (label) => {
      const { user, requests } = await renderLibrary();
      await select(user, TITLES[0] as string, TITLES[2] as string);

      await user.click(
        within(batchBar() as HTMLElement).getByRole('button', { name: 'Visibility' })
      );
      await user.click(await screen.findByRole('menuitem', { name: label }));

      expect(await screen.findByText('2 videos updated')).toBeInTheDocument();
      const visibility = label.toLowerCase();
      expect(requests).toEqual(
        expect.arrayContaining([
          { method: 'PATCH', id: videoIdOf(0), body: { visibility, version: 2 } },
          { method: 'PATCH', id: videoIdOf(2), body: { visibility, version: 4 } },
        ])
      );
    }
  );

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
      { method: 'PATCH', id: videoIdOf(1), body: { visibility: 'unlisted', version: 3 } },
    ]);
  });
});
